# Install

This comprehensive guide will walk you through the process of setting up a node using Docker. By following these steps, you'll clone the repository, build the Docker image, and configure your node for optimal performance.

## Environment Requirements

Before you begin, ensure you have the following installed on your system:

- **Git**: Version control system.
- **Docker**: Containerization platform.
- **Docker Compose**: Tool for defining and running multi-container Docker applications.

You can verify these installations by running the following commands in your terminal:

```sh
git --version
docker --version
docker compose --version
```

## Step 1: Clone the Repository

First, clone the repository using the following command:

```sh
git clone https://github.com/tangentcash/cash --recursive
```

This command will create a local copy of the repository on your machine. The `--recursive` flag ensures that any submodules are also cloned.

## Step 2: Build the Docker Image

Navigate to the root directory of the cloned repository and build the Docker image using the following command:

```sh
docker build -f ./Dockerfile -t tangentcash:staging .
```

### Project arguments
You can customize the executable using project arguments.

- **`TAN_TEST`** builds a test target with multiple cases covered

- **`VI_LOGGING`** is a logging level (errors, warnings, default, debug, verbose), defaults to "default"

### Build Arguments

You can customize the build process by using build arguments.

- **`$CONFIGURE`**: Pass additional arguments to CMake. For example, to enable verbose logging and testing mode, you might use:
  ```sh
  --build-arg CONFIGURE=-DVI_LOGGING=verbose -DTAN_TEST=ON
  ```

- **`$COMPILE`**: Pass additional arguments to the C++ compiler. For example, to use all cores for build process, you might use:
  ```sh
  --build-arg COMPILE=-j
  ```

## Step 3: Node configuration

Create a configuration file named `node.json` in the root directory of your project. This file will contain the settings for your node. Here is an example configuration:

```json
{
    "bootstrap_nodes": [
        "https://p2p.tangent.cash:18420?consensus=1"
    ],
    "consensus": {
        "address": "0.0.0.0"
    },
    "discovery": {
        "address": "0.0.0.0",
        "server": true
    },
    "rpc": {
        "address": "0.0.0.0",
        "server": true
    }
}
```

This configuration sets up your node to listen on all network interfaces (`0.0.0.0`) for consensus, discovery, and RPC services. The consensus server is active by default and relies on a bootstrap node(s) to find initial peers for synchronization.

## Step 4: Docker Compose configuration

Create a `docker-compose.yml` file in the root directory of your project with the following content:

```yml
services:
  node:
    image: tangentcash:staging
    ports:
      - "18418:18418"
      - "18419:18419"
      - "18420:18420"
    volumes:
      - ./node.json:/etc/tangentcash.json:ro
      - ./data:/var/lib/tangentcash
    command: ["tangentcash", "/etc/tangentcash.json"]
```

### Explanation

- **`image`**: Specifies the Docker image to use, which we built in Step 2.
- **`ports`**: Maps the container ports to the host ports. This example uses ports 18418, 18419, and 18420 for different services.
- **`volumes`**:
  - `./node.json:/etc/tangentcash.json:ro`: Mounts the `node.json` configuration file into the container. The `:ro` flag makes the mount read-only.
  - `./data:/var/lib/tangentcash`: Mounts a local directory for persistent data storage.

### Run Docker Compose

Finally, run the following command to start your node:

```sh
docker-compose up -d
```

The `-d` flag runs the containers in detached mode, allowing you to continue using your terminal.

## Verification

To verify that your node is running correctly, you can check the logs using:

```sh
docker-compose logs -f
```

This command will stream the logs from your node container, allowing you to monitor its activity and ensure it is functioning as expected.