# Attendify Auto-Absent Marking Test Scripts Guide

This document provides an overview of the available scripts for testing the auto-absent marking functionality in Attendify.

## Core Test Scripts

### 1. Simple Testing

- **simple-trigger.ps1**: Basic script to trigger the auto-marking endpoint with current time.
  ```powershell
  .\simple-trigger.ps1
  ```

### 2. Debugging

- **debug-trigger.ps1**: Enhanced version of simple-trigger with debug mode enabled.
  ```powershell
  .\debug-trigger.ps1
  ```

- **test-with-extended-debug.ps1**: Adds extra debug logging to the API endpoint temporarily.
  ```powershell
  .\test-with-extended-debug.ps1
  ```

### 3. Time Simulation

- **test-with-time-override.ps1**: Test with a simulated time to trigger specific scenarios.
  ```powershell
  .\test-with-time-override.ps1
  ```

- **test-auto-mark-function.js**: JavaScript-based test with flexible time override options.
  ```powershell
  node test-auto-mark-function.js --debug --time "2023-05-30T20:05:00.000Z"
  ```

### 4. Specialized Testing

- **test-specific-session.ps1**: Test auto-marking for a specific classroom session.
  ```powershell
  .\test-specific-session.ps1
  ```

## Creating Test Data

- **create-timing-test.ps1**: Creates a test classroom with specific timing for testing auto-marking.
  ```powershell
  .\create-timing-test.ps1
  ```

- **create-test-students.ps1**: Adds test students to classrooms.
  ```powershell
  .\create-test-students.ps1
  ```

## Setup Scripts

- **setup-auto-attendance-scheduler.ps1**: Creates a Windows scheduled task to run auto-marking every 5 minutes.
  ```powershell
  .\setup-auto-attendance-scheduler.ps1
  ```

## Monitoring

- **monitor-attendance-cron.ps1**: Monitors the execution of the auto-marking cron job.
  ```powershell
  .\monitor-attendance-cron.ps1
  ```

## When to Use Each Script

1. **First-time setup**:
   - Run `setup-auto-attendance-scheduler.ps1` to set up automated local testing
   - Use `create-timing-test.ps1` to create test data

2. **Quick testing**:
   - Use `simple-trigger.ps1` for basic endpoint testing
   - Use `debug-trigger.ps1` for more detailed output

3. **Advanced testing**:
   - Use `test-with-time-override.ps1` to test with a specific time
   - Use `test-specific-session.ps1` to target a specific classroom session

4. **Troubleshooting**:
   - Use `test-with-extended-debug.ps1` for maximum debug information
   - Check `monitor-attendance-cron.ps1` for scheduled task execution
