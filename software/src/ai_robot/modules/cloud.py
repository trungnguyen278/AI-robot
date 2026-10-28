# SPDX-License-Identifier: MIT
"""Cloud: the robot's link to ai-robot-server."""

from __future__ import annotations

import asyncio
import math
import secrets
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from typing import Any, TypeVar

from ai_robot.core.bus import Message, Subscription
from ai_robot.core.checks import positive
from ai_robot.core.data import Schema
from ai_robot.core.jose import b64url, b64url_json
from ai_robot.core.module import Module, ModuleContext
from ai_robot.messages import (
    BatteryReport,
    BindingChanged,
    CapabilityCall,
    CapabilityCancelled,
    CapabilityOffered,
    CapabilityResult,
    CapabilityWithdrawn,
    CloudStatus,
    ConversationFromCloud,
    ConversationOffered,
    ConversationToCloud,
    EventOffered,
    RegistrationRequested,
    RegistrationSigned,
    RobotEvent,
)
from ai_robot.ports.binding import Binding, BindingStore
from ai_robot.ports.body import BatteryStatus
from ai_robot.ports.cloud import (
    CallCancelled,
    Capability,
    Cloud,
    EventKind,
    SafetyClass,
    ToolCall,
    TurnStart,
    check_url,
)
from ai_robot.ports.identity import Identity

M = TypeVar("M", bound=Message)

# Unread parts of the robot's conversation the module keeps: far more than can pile up,
# since the link takes each part as it comes, and drops those of a session that is gone.
CONVERSATION_BACKLOG = 1000

# Fixed by the protocol (protocol/setup/README.md, The registration).
REGISTRATION_TYPE = "robot-registration+jwt"


async def registration(identity: Identity, challenge: str, server: str) -> str:
    """The robot's registration with ``server`` for ``challenge``: a JWT signed with
    ES256 by its key, which carries the public key (protocol/setup/README.md)."""
    robot = await identity.robot_id()
    header = {"alg": "ES256", "typ": REGISTRATION_TYPE, "jwk": dict(await identity.public_key())}
    claims = {
        "iss": robot,
        "sub": robot,
        "aud": server,
        "nonce": challenge,
        "jti": secrets.token_urlsafe(16),
    }
    signed = f"{b64url_json(header)}.{b64url_json(claims)}"
    return f"{signed}.{b64url(await identity.sign(signed.encode('ascii')))}"


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
    - Conversations: once a module offers to hold them (``ConversationOffered``), the
      link offers them too. This module carries the module's part
      (``ConversationToCloud``) to the link, with the robot's context at the start of
      each turn, and the cloud's part back (``ConversationFromCloud``).
    - ``CloudStatus`` tells the other modules when a session opens and closes, and
      whether it has conversations.
    - The robot's ``identity`` proves who it is when the link asks the server for its
      tokens (docs/decisions/0010-device-identity.md).
    - Set-up: this module signs the robot's registration (``RegistrationRequested``,
      ``RegistrationSigned``), then asks the server it names for the robot's tokens. The
      robot is bound once that server accepts it, and unbound when the server no longer
      knows it; ``binding`` keeps that across restarts, and ``BindingChanged`` tells the
      other modules (protocol/setup/README.md).
    """

    owns = ("cloud", "identity", "binding")

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
        self.identity = self.port("identity", Identity)
        self.store = self.port("binding", BindingStore)
        self.binding = Binding()
        self.robot_id = ""
        self.capabilities: dict[str, Offer] = {}  # by name
        self.events: dict[str, tuple[EventKind, Schema]] = {}
        self.conversing: ConversationOffered | None = None  # the module that holds them
        self.battery: BatteryStatus | None = None
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
        self.conversation_offers = self._subscribe(ConversationOffered)
        self.said = self._subscribe(ConversationToCloud, maxsize=CONVERSATION_BACKLOG)
        self.batteries = self._subscribe(BatteryReport)
        self.registrations = self._subscribe(RegistrationRequested)

    def _subscribe(self, kind: type[M], maxsize: int = 100) -> Subscription[M]:
        subscription = self.bus.subscribe(kind, maxsize=maxsize)
        self.subscriptions.append(subscription)
        return subscription

    async def start(self) -> None:
        self.robot_id = await self.identity.robot_id()
        self.binding = await self.store.load()
        await self.link.identify(self.identity)
        if self.binding.server is not None:
            try:
                await self.link.serve(self.binding.server)
            except ValueError as error:
                self.log.error("the robot's server cannot be used: %s", error)
        self.bus.publish(BindingChanged(self.robot_id, self.binding.bound))

    async def run(self) -> None:
        # Take what the modules offered while they started, so that the first session
        # already lists it; the link connects once it knows.
        while self.offers.pending:
            self._on_offer(await self.offers.get())
        while self.event_offers.pending:
            self._on_event_offer(await self.event_offers.get())
        while self.conversation_offers.pending:
            self._on_conversation_offer(await self.conversation_offers.get())
        await self._offer()
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(self._follow(self.offers, self._changed(self._on_offer)))
            tasks.create_task(self._follow(self.withdrawals, self._changed(self._on_withdrawal)))
            tasks.create_task(self._follow(self.event_offers, self._changed(self._on_event_offer)))
            tasks.create_task(
                self._follow(self.conversation_offers, self._changed(self._on_conversation_offer))
            )
            tasks.create_task(self._follow(self.robot_events, self._on_robot_event))
            tasks.create_task(self._follow(self.results, self._on_result))
            tasks.create_task(self._follow(self.batteries, self._on_battery))
            tasks.create_task(self._follow(self.said, self._say))
            tasks.create_task(self._follow(self.registrations, self._register))
            tasks.create_task(self._serve_calls())
            tasks.create_task(self._hear())
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

    def _on_conversation_offer(self, message: ConversationOffered) -> None:
        if self.conversing is not None and self.conversing.owner != message.owner:
            self.log.error(
                "%s offers to hold conversations, which %s already does; ignored",
                message.owner,
                self.conversing.owner,
            )
            return
        self.conversing = message

    async def _offer(self) -> None:
        await self.link.offer(
            [
                offer.capability
                for _, offer in sorted(self.capabilities.items())
                if offer.capability.safety in self.allowed
            ],
            [kind for _, (kind, _) in sorted(self.events.items())],
            conversation=None if self.conversing is None else self.conversing.audio,
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
            if status.bound is not None and status.bound != self.binding.bound:
                await self._bind(status.bound)
            if status.online == self.online:
                continue
            self.online = status.online
            if status.online:
                events = ", ".join(sorted(status.events)) or "none"
                self.log.info("cloud session %s open; events: %s", status.session, events)
            else:
                self.log.info("cloud session closed")
            self.bus.publish(CloudStatus(status.online, status.conversations))

    # ---- set-up ----

    async def _keep(self) -> None:
        """Save the binding. If it cannot be saved, the robot goes on with it in memory."""
        try:
            await self.store.save(self.binding)
        except OSError as error:
            self.log.error("cannot keep the robot's binding: %s", error)

    async def _bind(self, bound: bool) -> None:
        """The server said that it accepts the robot, or no longer knows it."""
        self.binding = Binding(self.binding.server, bound)
        await self._keep()
        if bound:
            self.log.info("the robot's server accepts it: it is set up")
        else:
            self.log.warning("the robot's server does not know it: it must be set up")
        self.bus.publish(BindingChanged(self.robot_id, bound))

    async def _register(self, request: RegistrationRequested) -> None:
        """Sign the registration the app asked for, then use the server it names."""

        def refuse(error: str, detail: str) -> None:
            self.bus.publish(RegistrationSigned(request.request, error=error, detail=detail))

        if self.binding.bound:
            refuse("bound", "the robot is bound: a new owner needs a reset")
            return
        try:
            server = check_url("server", request.server, ("https", "http"))
        except ValueError as error:
            refuse("server", str(error))
            return
        try:
            signed = await registration(self.identity, request.challenge, server)
        except Exception as error:  # a TPM can fail in many ways; set-up must say so
            self.log.exception("the robot could not sign its registration")
            refuse("identity", f"the robot could not sign: {type(error).__name__}")
            return
        self.binding = Binding(server, False)
        await self._keep()
        await self.link.serve(server)
        self.log.info("the robot signed its registration")
        self.bus.publish(RegistrationSigned(request.request, signed))

    # ---- conversations ----

    async def _on_battery(self, message: BatteryReport) -> None:
        self.battery = message.status

    async def _say(self, message: ConversationToCloud) -> None:
        part = message.part
        if isinstance(part, TurnStart):
            part = replace(part, context=self._context())
        await self.link.converse(part)

    def _context(self) -> dict[str, Any]:
        """The robot's situation, for the cloud, at the start of a turn (IO-4)."""
        battery = self.battery
        percent = None if battery is None else battery.percent
        if percent is not None:  # a reading may stray: keep the message valid
            percent = min(100.0, max(0.0, percent)) if math.isfinite(percent) else None
        return {"battery": percent, "charging": None if battery is None else battery.charging}

    async def _hear(self) -> None:
        while True:
            self.bus.publish(ConversationFromCloud(await self.link.conversation()))
            # Parts may come many at once, such as pieces of text: let the module that
            # holds the conversation take each one before the next, so that its queue
            # does not overflow.
            await asyncio.sleep(0)
