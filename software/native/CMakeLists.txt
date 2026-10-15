# SPDX-License-Identifier: MIT
cmake_minimum_required(VERSION 3.15...3.30)
project(${SKBUILD_PROJECT_NAME} LANGUAGES CXX)

set(PYBIND11_FINDPYTHON ON)
find_package(pybind11 CONFIG REQUIRED)

pybind11_add_module(ai_robot_native src/module.cpp)
target_compile_features(ai_robot_native PRIVATE cxx_std_17)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(ai_robot_native PRIVATE -Wall -Wextra -Wpedantic)
endif()

install(TARGETS ai_robot_native LIBRARY DESTINATION .)
