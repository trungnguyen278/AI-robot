# Raspberry Pi AI Camera (Sony IMX500)

> Last updated: 2026-10-15. Sources are shop and distributor pages → re-check against the official documentation when possible.

- **Role in the robot:** the eyes — runs vision models on the sensor itself, offloading the Pi's CPU.
- **Exact model / variant:** Raspberry Pi AI Camera (SC1174).
- **Quantity:** 1
- **Connected to:** the Pi 5 CSI port (cable included).

## Key specifications

| Parameter | Value | Source |
|---|---|---|
| Sensor | Sony IMX500, 12.3 MP, with an on-sensor neural network accelerator | Pimoroni; Mouser |
| Modes | 2028×1520 at 30 fps (2×2 binned); 4056×3040 at 10 fps; 10-bit | Pimoroni |
| Optics | F1.79, 4.74 mm focal length, manual focus 20 cm–∞; ~78° diagonal FoV (66° horizontal / 52.3° vertical) | Pimoroni; Mouser |
| Controller | RP2040 + 16 MB flash to load and cache models | CNX Software |
| Model input | Up to 640×640 int8/uint8 tensors | Mouser |
| Software | libcamera, Picamera2, rpicam-apps; inference results arrive as metadata alongside each frame | PiShop; Mouser |
| Example models | MobileNet SSD (object detection), PoseNet (pose estimation); PyTorch/TensorFlow models can be converted with Raspberry Pi's tools | Elektor |

## Notes for this robot

- Focus is manual → set it for the main working distance before final mounting.
- Models that exceed the IMX500's limits run on the Pi's CPU or on the server.

## References (retrieved 2026-10-15)

- [Pimoroni](https://shop.pimoroni.com/en-eu/products/raspberry-pi-ai-camera)
- [Mouser](https://www.mouser.com/new/raspberry-pi/raspberry-pi-ai-camera/)
- [CNX Software](https://www.cnx-software.com/2024/10/01/raspberry-pi-ai-camera-with-sony-imx500-ai-sensor-and-rp2040-mcu/)
- [Elektor](https://elektormagazine.com/articles/raspberry-pi-ai-camera)
- [PiShop](https://www.pishop.us/product/raspberry-pi-ai-camera/)
