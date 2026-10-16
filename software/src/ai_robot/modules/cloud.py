# SPDX-License-Identifier: MIT
"""Cloud: the robot's link to ai-robot-server."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, TypeVar

from ai_robot.core.bus import Message, Subscription
from ai_robot.core.checks import positive
from ai_robot.core.data import Schema
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import (
    CapabilityCall,
    CapabilityCancelled,
    CapabilityOffered,
    CapabilityResult,
    CapabilityWithdrawn,
    CloudStatus,
    EventOffered,
    RobotEvent,
)
from ai_robot.ports.cloud import CallCancelled, Capability, Cloud, EventKind, SafetyClass, ToolCall

M = TypeVar("M", bound=Message)


@dataclass(frozen=True, slots=True)
class Offer:
    """A capability in the catalogue, with its owner and its compiled schemas."""

    owner: str
    capability: Capability
    inputs: Schema
    outputs: Schema | None


class CloudModule(Module):
    """Connects the robot to the cloud (protocol/cloud/README.md).

    - Capabilities: modules offer them on the bus (``CapabilityOffered``). The cloud
      sees those whose safety class the robot's owner allows (``allowed_classes``), a
      setting the cloud cannot change (requirements SEC-9). This module checks each
      call's arguments against the capability's input schema, hands the call to the
      capability's owner (``CapabilityCall``) and returns the owner's
      ``CapabilityResult``, or an error after ``call_timeout`` seconds.
    - Events: modules declare them (``EventOffered``) and publish them (``RobotEvent``);
      the link sends those the cloud subscribed to.
    - ``CloudStatus`` tells the other modules when a session opens and closes.

    Planned: turns and responses for the voice module, once it has a wake word.
    """

    owns = ("cloud",)

    def __init__(
        self, ctx: ModuleContext, *, allowed_classes: list[str], call_timeout: float
    ) -> None:
        super().__init__(ctx)
        known = {safety.value for safety in SafetyClass}
        unknown = sorted(set(allowed_classes) - known)
        if unknown:
            raise ValueError(
                f"allowed_classes: unknown classes {unknown} (known: {', '.join(sorted(known))})"
            )
        self.allowed = frozenset(SafetyClass(name) for name in allowed_classes)
        self.call_timeout = positive("call_timeout", call_timeout)
        self.link = self.port("cloud", Cloud)
        self.capabilities: dict[str, Offer] = {}  # by name
        self.events: dict[str, tuple[EventKind, Schema]] = {}
        self.online = False
        self._calls: dict[str, asyncio.Task[None]] = {}  # call id -> the task answering it
        self._results: dict[str, asyncio.Future[CapabilityResult]] = {}
        self._warned: set[str] = set()
        self.subscriptions: list[Subscription[Any]] = []
        self.offers = self._subscribe(CapabilityOffered)
        self.withdrawals = self._subscribe(CapabilityWithdrawn)
        self.event_offers = self._subscribe(EventOffered)
        self.robot_events = self._subscribe(RobotEvent)
        self.results = self._subscribe(CapabilityResult)

    def _subscribe(self, kind: type[M]) -> Subscription[M]:
        subscription = self.bus.subscribe(kind)
        self.subscriptions.append(subscription)
        return subscription

    async def run(self) -> None:
        # Take what the modules offered while they started, so that the first session
        # already lists it; the link connects once it knows.
        while self.offers.pending:
            self._on_offer(await self.offers.get())
        while self.event_offers.pending:
            self._on_event_offer(await self.event_offers.get())
        await self._offer()
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._follow(self.offers, self._changed(self._on_offer)))
            tasks.create_task(self._follow(self.withdrawals, self._changed(self._on_withdrawal)))
            tasks.create_task(self._follow(self.event_offers, self._changed(self._on_event_offer)))
            tasks.create_task(self._follow(self.robot_events, self._on_robot_event))
            tasks.create_task(self._follow(self.results, self._on_result))
            tasks.create_task(self._serve_calls())
            tasks.create_task(self._follow_status())

    async def stop(self) -> None:
        for task in list(self._calls.values()):
            task.cancel()
        for subscription in self.subscriptions:
            subscription.close()

    @staticmethod
    async def _follow(
        subscription: Subscription[M], handle: Callable[[M], Awaitable[None]]
    ) -> None:
        async for message in subscription:
            await handle(message)

    def _changed(self, update: Callable[[M], None]) -> Callable[[M], Awaitable[None]]:
        """``update``, then tell the link what the robot offers now."""

        async def handle(message: M) -> None:
            update(message)
            await self._offer()

        return handle

    # ---- the catalogue ----

    def _on_offer(self, message: CapabilityOffered) -> None:
        capability = message.capability
        current = self.capabilities.get(capability.name)
        if current is not None and current.owner != message.owner:
            self.log.error(
                "%s offers capability %s, which %s already offers; ignored",
                message.owner,
                capability.name,
                current.owner,
            )
            return
        outputs = capability.output_schema
        self.capabilities[capability.name] = Offer(
            message.owner,
            capability,
            Schema(f"{capability.name} input_schema", capability.input_schema),
            None if outputs is None else Schema(f"{capability.name} output_schema", outputs),
        )
        if capability.safety not in self.allowed:
            self.log.info(
                "capability %s (%s) is kept from the cloud: allowed_classes",
                capability.name,
                capability.safety,
            )

    def _on_withdrawal(self, message: CapabilityWithdrawn) -> None:
        current = self.capabilities.get(message.name)
        if current is not None and current.owner == message.owner:
            del self.capabilities[message.name]

    def _on_event_offer(self, message: EventOffered) -> None:
        kind = message.kind
        self.events[kind.name] = (kind, Schema(f"{kind.name} schema", kind.schema))

    async def _offer(self) -> None:
        await self.link.offer(
            [
                offer.capability
                for _, offer in sorted(self.capabilities.items())
                if offer.capability.safety in self.allowed
            ],
            [kind for _, (kind, _) in sorted(self.events.items())],
        )

    # ---- calls ----

    async def _serve_calls(self) -> None:
        while True:
            request = await self.link.request()
            if isinstance(request, CallCancelled):
                task = self._calls.pop(request.id, None)
                if task is not None:
                    task.cancel()
                    self.bus.publish(CapabilityCancelled(request.id))
                continue
            task = asyncio.create_task(self._answer(request), name=f"call {request.name}")
            self._calls[request.id] = task
            task.add_done_callback(lambda done, call=request.id: self._forget(call, done))

    def _forget(self, call: str, task: asyncio.Task[None]) -> None:
        if self._calls.get(call) is task:
            del self._calls[call]
        if not task.cancelled() and task.exception() is not None:
            self.log.error("call %s failed", call, exc_info=task.exception())

    async def _answer(self, call: ToolCall) -> None:
        offer = self.capabilities.get(call.name)
        if offer is None or offer.capability.safety not in self.allowed:
            await self.link.reply(call, error=f"unknown capability {call.name}")
            return
        problem = offer.inputs.problem(call.arguments)
        if problem is not None:
            await self.link.reply(call, error=f"invalid arguments: {problem}")
            return
        result = asyncio.get_running_loop().create_future()
        self._results[call.id] = result
        try:
            self.bus.publish(CapabilityCall(call.id, call.name, call.arguments))
            outcome = await asyncio.wait_for(result, self.call_timeout)
        except TimeoutError:
            await self.link.reply(
                call, error=f"{call.name} did not answer within {self.call_timeout:g} s"
            )
            return
        finally:
            self._results.pop(call.id, None)
        if outcome.error is not None:
            await self.link.reply(call, error=outcome.error)
            return
        if offer.outputs is not None:
            problem = offer.outputs.problem(outcome.data)
            if problem is not None:
                self.log.error("%s returned data that breaks its schema: %s", call.name, problem)
                await self.link.reply(call, error="internal error")
                return
        await self.link.reply(call, data=outcome.data)

    async def _on_result(self, message: CapabilityResult) -> None:
        result = self._results.get(message.call)
        if result is not None and not result.done():
            result.set_result(message)

    # ---- events and status ----

    async def _on_robot_event(self, message: RobotEvent) -> None:
        entry = self.events.get(message.name)
        if entry is None:
            self._warn_once(message.name, "event %s was never offered; dropped", message.name)
            return
        problem = entry[1].problem(message.data)
        if problem is not None:
            self._warn_once(
                message.name, "event %s breaks its schema (%s); dropped", message.name, problem
            )
            return
        await self.link.emit(message.name, message.data)

    def _warn_once(self, key: str, text: str, *args: object) -> None:
        if key not in self._warned:
            self._warned.add(key)
            self.log.warning(text, *args)

    async def _follow_status(self) -> None:
        while True:
            status = await self.link.status()
            if status.online == self.online:
                continue
            self.online = status.online
            if status.online:
                events = ", ".join(sorted(status.events)) or "none"
                self.log.info("cloud session %s open; events: %s", status.session, events)
            else:
                self.log.info("cloud session closed")
            self.bus.publish(CloudStatus(status.online))
