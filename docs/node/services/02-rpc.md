# RPC

## Overview

This documentation describes a fully JSON-RPC 2.0 compliant server with additional extensions for enhanced functionality and flexibility. The server supports transport over WebSockets, allowing real-time communication using the same JSON payloads as standard HTTP.

## Table of Contents

1. [JSON-RPC 2.0 Compliance](#json-rpc-20-compliance)
2. [WebSocket Transport](#websocket-transport)
3. [Error Handling](#error-handling)
4. [Notifications](#notifications)
5. [Subscriptions](#subscriptions)
6. [Extensions for Non-JSON Data](#extensions-for-non-json-data)

## JSON-RPC 2.0 Compliance

The server adheres to the JSON-RPC 2.0 specification, ensuring interoperability with a wide range of clients and services. Key features include:

- **Request/Response Model**: The server processes requests and returns responses in a standardized format.
- **Batch Requests**: Supports batch processing of multiple requests in a single payload.
- **Notification Support**: Allows one-way communication from the server to the client without expecting a response.

## WebSocket Transport

The server supports transport over WebSockets, enabling real-time, bidirectional communication. This transport method uses the same JSON payloads as standard HTTP, making it easy to integrate with existing JSON-RPC clients.

### Connection Setup

To connect to the server via WebSockets, use the following URL format:

```
ws://<server-address>/
```

### Example Payload

Here is an example of a JSON-RPC request payload sent over WebSockets:

```json
{
  "jsonrpc": "2.0",
  "method": "example_method",
  "params": ["param1", "param2"],
  "id": 1
}
```

## Error Handling

The server returns compact error codes that primarily focus on request scheme errors. The error object follows the JSON-RPC 2.0 specification and includes the following fields:

- `code`: A numeric error code.
- `message`: A human-readable string describing the error.
- `data` (optional): Additional information about the error.

### Example Error Response

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": null
}
```

## Notifications

The server supports notifications, which are one-way messages from the server to the client. Notification payloads replace the `result` field with a `notification` field.

### Example Notification

```json
{
  "jsonrpc": "2.0",
  "notification": ["param1", "param2"],
}
```

## Subscriptions

To receive notifications, clients must connect over WebSocket transport and call the `subscribe` method. This method allows clients to subscribe to specific events or topics.

### Subscription Example

```json
{
  "jsonrpc": "2.0",
  "method": "subscribe",
  "params": ["address1,address2,address3", true, true],
  "id": 2
}
```

## Extensions for Non-JSON Data

The server includes extensions to JSON-RPC for handling non-JSON data types. These extensions allow for more flexible and efficient data representation. Currently supported types: uint128, uint256, asset256

```json
{
  "jsonrpc": "2.0",
  "method": "method",
  "params": [
    {
      "other_field": 10,
      "uint128_field": ["$uint128", "1234567890123456789012345678901234567890"],
      "uint256_field": ["$uint256", "1234567890123456789012345678901234567890123456789012345678901234"],
      "asset1_field": ["$asset256", "ETH"],
      "asset2_field": ["$asset256", "ETH:USDT:0xdAC17F958D2ee523a2206206994597C13D831ec7"]
    }
  ],
  "id": 3
}
```