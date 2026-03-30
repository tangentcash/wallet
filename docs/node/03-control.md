# Control

The node executable provides a flexible command-line interface for configuring and running the node in various modes. This documentation outlines the argument structure, usage examples, and detailed information on smart contract development commands.

## Command Structure

The basic syntax for invoking the node executable is:

```sh
tangentcash [vm?] [args?]... [path?]
```

## Argument Breakdown

### `vm`

**Description**: Enables smart contract development mode when specified.

**Position**: Must be the first argument if used.

### `args`

**Description**: Configuration arguments that override settings in the config file.

**Examples**:

- `--storage.logging=true`

- `--network="regtest"`

**Position**: Can be placed anywhere between the `vm` flag and the `path`, but must precede the `path`.

### `path`

**Description**: Specifies the location of a JSON configuration file.

**Position**: Must be the last argument if used.

## Usage Examples

1. **Basic Configuration**:
    ```sh
    tangentcash --storage.logging=true ./config.json
    ```

2. **Smart Contract Development Mode**:
    ```sh
    tangentcash vm --network="regtest" ./config.json
    ```

3. **Using an Absolute Path**:
    ```sh
    tangentcash /etc/tangentcash/config.json
    ```

## Smart Contract Development Mode

When the `vm` flag is enabled, the node enters smart contract development mode, providing a comprehensive set of commands for managing and debugging smart contracts.

### Command Categories

Commands are organized into the following categories based on their functionality:

1. **Control Flow Commands**
2. **Address Management Commands**
3. **Balance and Payment Commands**
4. **Program Management Commands**
5. **Argument Packing/Unpacking Commands**
6. **Function Call Commands**
7. **Logging and Debugging Commands**
8. **Miscellaneous Commands**

### 1. Control Flow Commands

| Command     | Description                                                                  |
|-------------|------------------------------------------------------------------------------|
| `trap [type]` | Enable command interpreter based on execution status (all, err, off, now). |

### 2. Address Management Commands

| Command   | Description                                                      |
|-----------|------------------------------------------------------------------|
| `from [address?]` | Get/set caller address (random if ? is specified).       |
| `to [address?]`   | Get/set contract address (random if ? is specified).     |

### 3. Balance and Payment Commands

| Command           | Description                                                          |
|-------------------|----------------------------------------------------------------------|
| `fund [value?]...` | Get/set caller address balance with optional parameters.            |
| `pay [value?]...` | Get/set caller address paying value with optional parameters.        |
| `pay_funded...`   | Combine fund and pay operations with optional parameters.            |

### 4. Program Management Commands

| Command         | Description                                                          |
|-----------------|----------------------------------------------------------------------|
| `execp [path]`  | Run a predefined execution plan from a JSON file.                    |
| `compile [path]`| Compile and use the specified program.                               |
| `assemble...`   | Assemble the current program based on specified type and parameters. |

### 5. Argument Packing/Unpacking Commands

| Command        | Description                                                            |
|----------------|------------------------------------------------------------------------|
| `pack [args?]...` | Pack multiple arguments into a single argument for function calls.  |
| `pack256...`   | Pack a decimal uint256 into a hex number.                              |
| `pack3_256...` | Pack an asset into uint256 format.                                     |
| `unpack [stream]` | Unpack a stream into multiple arguments.                            |
| `unpack256...`  | Unpack a hex uint256 into a decimal number.                           |

### 6. Function Call Commands

| Command        | Description                                                                       |
|----------------|-----------------------------------------------------------------------------------|
| `call [declaration] [args?]...` | Call a function in the current program with specified arguments. |
| `debug [declaration] [args?]...` | Call a function with a debugger attached for inspection.        |

### 7. Logging and Debugging Commands

| Command               | Description                                                              |
|-----------------------|--------------------------------------------------------------------------|
| `result`              | Get the call result log.                                                 |
| `log`                 | Get the call event log.                                                  |
| `changelog`           | Get the call state changes log.                                          |
| `state_check [hash]`  | Verify state root hash derived from current changelog.                   |
| `receipt`             | Get the call receipt.                                                    |
| `abi`                 | Get the program ABI listing.                                             |

### 8. Miscellaneous Commands

| Command        | Description                                                              |
|----------------|--------------------------------------------------------------------------|
| `predefined [path]` | Export symbols for AngelScript Language Server (as.predefined)      |
| `reset`             | Reset the contract state.                                           |
| `clear`             | Clear the console output.                                           |
| `help`              | Show an explainer message with available commands and usage.        |

## Smart Contract Debugger

The debugger provides a set of commands to control and inspect the execution of smart contracts.

### Debugger Commands

| Command       | Description                                                            |
|---------------|------------------------------------------------------------------------|
| `h, help`     | Show available debugger commands.                                      |
| `r, require`  | Load a system or external addon.                                       |
| `f, finish`   | Step out of the current subroutine.                                    |
| `p, print`    | Print the value of a variable.                                         |
| `e, eval`     | Evaluate a script expression.                                          |
| `i, info`     | Show information about a specific topic.                               |

### Info Subcommands

| Subcommand          | Description                                                               |
|---------------------|---------------------------------------------------------------------------|
| `info b, info break` | Show current breakpoints.                                                |
| `info s, info stack <level?>` | Show stack registers at the specified level.                    |
| `info e, info exception` | Show the current exception.                                          |
| `info l, info locals` | Show local variables.                                                   |
| `info m, info members` | Show member properties.                                                |
| `info g, info globals` | Show global variables.                                                 |
| `info t, info threads` | Show suspended threads.                                                |
| `info c, info code` | Show the source code section.                                             |
| `info a, info addons` | Show imported addons.                                                   |
| `info f, info function <declaration>` | Dump compiled function bytecode by name or declaration. |
| `info gc, info garbage` | Show garbage collection statistics.                                   |

### Control Commands

| Command       | Description                             |
|---------------|-----------------------------------------|
| `d, delete`   | Delete a breakpoint.                    |
| `b, break`    | Add a breakpoint.                       |
| `c, continue` | Continue execution.                     |
| `t, thread`   | Switch to a thread by its number.       |
| `s, step`     | Step into a subroutine.                 |
| `n, next`     | Step over a subroutine.                 |
| `a, abort`    | Abort the current execution.            |
| `bt, backtrace` | Show the current call stack.          |