# Discovery

The Discovery Service is a crucial component that facilitates the identification and communication between nodes in a distributed network. It operates by running an HTTP server that accepts GET requests, providing a mechanism to retrieve a list of URLs pointing to nodes with specific capabilities.

## Overview

The Discovery Service enables clients to query for nodes based on various criteria, allowing for efficient discovery and connection establishment within the network. This service is particularly useful in decentralized systems where nodes need to dynamically discover each other to participate in consensus or other collaborative tasks.

## API Endpoint

### Base URL
```
GET /?
```

## Query Parameters

The Discovery Service supports several query parameters that allow clients to filter the results based on specific node capabilities and attributes. These parameters are passed as part of the request URL.

| Parameter     | Type   | Description                                                                 | Values/Format                    |
|---------------|--------|-----------------------------------------------------------------------------|----------------------------------|
| `port`        | string | Specifies which port information to return.                                  | `"consensus"` \| `"discovery"` \| `"rpc"` |
| `consensus`   | int    | Indicates whether the node runs a consensus service.                          | `1` (true) \| `0` (false)       |
| `discovery`   | int    | Indicates whether the node runs a discovery service.                           | `1` (true) \| `0` (false)       |
| `superchain`  | int    | Indicates whether the node runs a superchain service.                         | `1` (true) \| `0` (false)       |
| `rpc`         | int    | Indicates whether the node runs an RPC service.                              | `1` (true) \| `0` (false)       |
| `production`  | int    | Indicates whether the node is a block producer.                               | `1` (true) \| `0` (false)       |
| `participation`| int   | Indicates whether the node is a bridge participant.                       | `1` (true) \| `0` (false)       |
| `attestation` | int    | Indicates whether the node is a bridge attester.                           | `1` (true) \| `0` (false)       |
| `offset`      | number | Specifies the offset for pagination, determining where to start returning results. | Any non-negative integer        |
| `count`       | number | Specifies the maximum number of results to return.                              | Any positive integer            |

## Example Request

To retrieve a list of nodes that run a consensus service, you can use the following request:

```
GET /?consensus=1
```

## Example Response

The response will be a JSON array containing URLs of the nodes that match the specified criteria. For example:

```json
[
  "tcp://192.168.1.10:18418",
  "tcp://selfhost:18418"
]
```

### Special Note on `selfhost`

The term **`selfhost`** is a specific hostname that must be interpreted as the address of the node that served the discovery request. This allows nodes to refer to themselves in a standardized way, facilitating self-referential operations within the network.

## Usage Scenarios

1. **Node Discovery**: Clients can use the Discovery Service to find available nodes for connecting and participating in the network.
2. **Service Filtering**: By specifying service-related parameters (e.g., `consensus`, `rpc`), clients can target nodes with specific functionalities.
3. **Pagination**: The `offset` and `count` parameters enable efficient handling of large networks by allowing clients to retrieve results in manageable chunks.

## Best Practices

- **Caching**: Implement caching mechanisms on the client side to reduce the frequency of discovery requests, especially in stable networks.
- **Error Handling**: Ensure robust error handling to manage cases where the Discovery Service is unavailable or returns unexpected results.
- **Security**: Consider securing the Discovery Service to prevent unauthorized access and potential abuse.

By leveraging the Discovery Service, clients can effectively navigate and interact with a dynamic network of nodes, ensuring efficient and reliable communication within the system.