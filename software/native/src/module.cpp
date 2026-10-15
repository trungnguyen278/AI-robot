// SPDX-License-Identifier: MIT
//
// C++ extension for ai_robot. Every function here has a pure-Python twin with the same
// behavior in src/ai_robot/native.py; tests/test_native.py checks that they agree.

#include <pybind11/pybind11.h>

#include <cmath>
#include <cstddef>
#include <cstdint>

namespace py = pybind11;

namespace {

// Root mean square of signed 16-bit little-endian PCM samples (0.0 if empty).
double rms_int16(const py::buffer& pcm) {
    const py::buffer_info info = pcm.request();
    if (info.ndim != 1 || info.itemsize != 1 || info.strides[0] != 1) {
        throw py::type_error("pcm must be a contiguous buffer of bytes");
    }
    const auto size = static_cast<std::size_t>(info.size);
    if (size % 2 != 0) {
        throw py::value_error("PCM data must contain whole 16-bit samples");
    }
    const std::size_t count = size / 2;
    if (count == 0) {
        return 0.0;
    }
    const auto* bytes = static_cast<const std::uint8_t*>(info.ptr);
    double sum = 0.0;
    for (std::size_t i = 0; i < count; ++i) {
        int sample = bytes[2 * i] | (bytes[2 * i + 1] << 8);
        if (sample >= 0x8000) {
            sample -= 0x10000;
        }
        sum += static_cast<double>(sample) * sample;
    }
    return std::sqrt(sum / static_cast<double>(count));
}

}  // namespace

PYBIND11_MODULE(ai_robot_native, m) {
    m.doc() = "C++ extension for ai_robot; use it through ai_robot.native";
    m.def("rms_int16", &rms_int16, py::arg("pcm"),
          "Root mean square of signed 16-bit little-endian PCM samples (0.0 if empty).");
}
