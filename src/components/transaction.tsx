import { Avatar, Badge, Box, Button, Card, Code, DataList, DropdownMenu, Flex, Spinner, Text } from "@radix-ui/themes";
import { Readability } from "../core/text";
import { Interface, InterfaceUtil, Netstat, SummaryState } from "../core/wallet";
import { AlertBox, AlertType } from "./alert";
import { AssetId } from "../core/tangent/algorithm";
import { Link } from "react-router";
import { useState } from "react";
import { Types } from "../core/tangent/types";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";

function InputFields(props: { orientation: 'horizontal' | 'vertical', transaction: any }) {
  const transaction = props.transaction;
  switch (transaction.type) {
    case 'transfer':
      return transaction.transfers.map((item: any, index: number) =>
        <Card key={item.to + index} mb={index == transaction.transfers.length - 1 ? '0' : '4'}>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>To account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(item.to);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(item.to) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + item.to}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Value paid:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(transaction.asset, item.value) }</DataList.Value>
            </DataList.Item>
            {
              item.memo != null &&
              <DataList.Item>
                <DataList.Label>Memo:</DataList.Label>
                <DataList.Value>{ item.memo }</DataList.Value>
              </DataList.Item>
            }
          </DataList.Root>
        </Card>
      )
    case 'deployment': {
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Program hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.location_address);
                AlertBox.open(AlertType.Info, 'Program hash copied!')
              }}>{ Readability.toHash(transaction.location_address) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Program calldata:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                const data: any = JSON.stringify(transaction.args, null, 2);
                navigator.clipboard.writeText(data);
                AlertBox.open(AlertType.Info, 'Program calldata copied!')
              }}>{ Readability.toHash(transaction.calldata) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Program arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                const data: any = JSON.stringify(transaction.args, null, 2);
                navigator.clipboard.writeText(data);
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toHash(args) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Properties:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.patchable ? 'red' : 'green' } mr="2">{ transaction.patchable ? 'Mutable' : 'Immutable' }</Badge>
              <Badge color={ transaction.segregated ? 'green' : 'red' }>{ transaction.segregated ? 'Program reuse' : 'New program' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    }
    case 'invocation': {
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.to);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.to) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/account/' + transaction.to}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Function:</DataList.Label>
            <DataList.Value>
              <Badge>{ transaction.function } 0x{ transaction.hashcode.toString(16) }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
                AlertBox.open(AlertType.Info, 'Invocation arguments copied!')
              }}>{ Readability.toHash(args) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    }
    case 'rollup':
      return (
        <Box>
          <Text>Internal transactions:</Text>
          <Card mt="2">
            {
              transaction.transactions.map((item: any, index: number) =>
                <Flex align="center" gap="2" key={item.to + index} mb={index == transaction.transactions.length - 1 ? '0' : '4'}>
                  <Avatar size="1" radius="full" fallback={(item.asset.token || item.asset.chain)[0]} src={'/cryptocurrency/' + (item.asset.token || item.asset.chain).toLowerCase() + '.svg'} />
                  <Badge size="2" variant="soft">{ Readability.toTransactionType(item.type) }</Badge>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(item.hash);
                    AlertBox.open(AlertType.Info, 'Internal transaction hash copied!')
                  }}>{ Readability.toHash(item.hash) }</Button>
                  <Link className="router-link" to={'/transaction/' + item.hash}>▒▒</Link>
                </Flex>
              )
            }
          </Card>
        </Box>
      )
    case 'certification':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Validator status:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.online == 1 ? 'green' : (transaction.online == -1 ? 'gray' : 'red') }>{ transaction.online == 1 ? 'Online' : (transaction.online == -1 ? 'Standby' : 'Offline') }</Badge>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.observers.map((observer: any) => 
              <DataList.Item key={observer.asset.chain}>
                <DataList.Label>{ observer.asset.chain } observer status:</DataList.Label>
                <DataList.Value>
                  <Badge color={ observer.online ? 'green' : 'red' }>{ observer.online ? 'Online' : 'Offline' }</Badge>
                </DataList.Value>
              </DataList.Item>
            )
          }
        </DataList.Root>
      )
    case 'routing_account':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Routing address:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.address);
                AlertBox.open(AlertType.Info, 'Routing address copied!')
              }}>{ Readability.toAddress(transaction.address) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_account':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Delegate proposer account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" disabled={!transaction.proposer} onClick={() => {
                navigator.clipboard.writeText(transaction.proposer || 'none');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.proposer) }</Button>
              {
                transaction.proposer &&
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + transaction.proposer}>▒▒</Link>
                </Box>
              }
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_account_finalization':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_account_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_account_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_account_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>MPC public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.mpc_public_key || 'none');
                AlertBox.open(AlertType.Info, 'MPC public key copied!')
              }}>{ Readability.toHash(transaction.mpc_public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_withdrawal':
      return (
        <>
          <DataList.Root orientation={props.orientation} mb="4">
            {
              transaction.proposer &&
              <DataList.Item>
                <DataList.Label>Proposer account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.proposer || 'none');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(transaction.proposer) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + transaction.proposer}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.from_proposer &&
              <DataList.Item>
                <DataList.Label>From proposer account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.from_proposer || 'none');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(transaction.from_proposer) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + transaction.from_proposer}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.to_proposer &&
              <DataList.Item>
                <DataList.Label>To proposer account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.to_proposer || 'none');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(transaction.to_proposer) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + transaction.to_proposer}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Execution policy:</DataList.Label>
              <DataList.Value>
                <Badge color={ transaction.only_if_not_in_queue ? 'red' : 'orange' }>{ transaction.only_if_not_in_queue ? 'Now or never' : 'May wait' }</Badge>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            transaction.to && transaction.to.map((item: any, index: number) =>
              <Card key={item.to + index} mb={index == transaction.to.length - 1 ? '0' : '4'}>
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>To address:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.address) }</Button>
                      <Box ml="2">
                        <Link className="router-link" to={'/account/' + item.address}>▒▒</Link>
                      </Box>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Value:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(transaction.asset, item.value) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    case 'depository_withdrawal_finalization':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_withdrawal_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_withdrawal_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_withdrawal_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.transaction_id &&
            <DataList.Item>
              <DataList.Label>Sent transaction id:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.transaction_id);
                  AlertBox.open(AlertType.Info, 'Transaction id copied!')
                }}>{ Readability.toHash(transaction.transaction_id) }</Button>
              </DataList.Value>
            </DataList.Item>
          }
          {
            transaction.native_data &&
            <DataList.Item>
              <DataList.Label>Sent native data:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.native_data);
                  AlertBox.open(AlertType.Info, 'Native data copied!')
                }}>{ Readability.toHash(transaction.native_data) }</Button>
              </DataList.Value>
            </DataList.Item>
          }
          {
            transaction.error_message &&
            <DataList.Item>
              <DataList.Label>Relay response:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.error_message || 'OK');
                  AlertBox.open(AlertType.Info, 'Response copied!')
                }}>{ transaction.error_message?.length > 16 ? Readability.toAddress(transaction.error_message) : 'OK' }</Button>
              </DataList.Value>
            </DataList.Item>
          }
        </DataList.Root>
      )
    case 'depository_transaction': {
      const from = transaction.assertion.inputs.map((item: any) => {
        return [{
          address: item.link.address || item.link.public_key || item.link.owner,
          asset: item.asset || transaction.asset,
          value: item.value
        }, ...item.tokens.map((token: any) => {
          return {
            address: item.link.address || item.link.public_key || item.link.owner,
            asset: token.asset ? token.asset : AssetId.fromHandle(transaction.asset.chain, token.symbol, token.contract_address),
            value: token.value
          };
        })]
      }).flat();
      const to = transaction.assertion.outputs.map((item: any) => {
        return [{
          address: item.link.address || item.link.public_key || item.link.owner,
          asset: item.asset || transaction.asset,
          value: item.value
        }, ...item.tokens.map((token: any) => {
          return {
            address: item.link.address || item.link.public_key || item.link.owner,
            asset: token.asset ? token.asset : AssetId.fromHandle(transaction.asset.chain, token.symbol, token.contract_address),
            value: token.value
          };
        })]
      }).flat();
      return (
        <>
          <DataList.Root orientation={props.orientation} mb="4">
            <DataList.Item>
              <DataList.Label>Transaction id:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.assertion.transaction_id);
                  AlertBox.open(AlertType.Info, 'Transaction id copied!')
                }}>{ Readability.toHash(transaction.assertion.transaction_id) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Block id:</DataList.Label>
              <DataList.Value>{ transaction.assertion.block_id?.toString() || 'none' }</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            from.map((item: any, index: number) =>
              <Card key={item.address + index} mb="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>From address:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.address) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Value out:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.value) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
          {
            to.map((item: any, index: number) =>
              <Card key={item.address + index} mb="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>To address:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.address) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Value in:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.value) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    }
    case 'depository_adjustment':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Deposit fee:</DataList.Label>
            <DataList.Value>{ ((transaction.incoming_relative_fee?.toNumber() || 0) * 100).toFixed(2) }% + { Readability.toMoney(transaction.asset, transaction.incoming_absolute_fee) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Withdrawal fee:</DataList.Label>
            <DataList.Value>{ ((transaction.outgoing_relative_fee?.toNumber() || 0) * 100).toFixed(2) }% + { Readability.toMoney(transaction.asset, transaction.outgoing_absolute_fee) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Security level:</DataList.Label>
            <DataList.Value>Requires { Readability.toCount('participant', transaction.security_level) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Account requests:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.accepts_account_requests ? 'green' : 'red' }>{ transaction.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Withdrawal requests:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.accepts_withdrawal_requests ? 'green' : 'red' }>{ transaction.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_migration':
      return (
          transaction.migrations.map((item: any, index: number) =>
            <Card key={item.proposer + index} mb="4">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Proposer:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(item.proposer);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(item.proposer) }</Button>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Owner:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(item.owner);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(item.owner) }</Button>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Asset:</DataList.Label>
                  <DataList.Value>{ (item.asset.token || item.asset.chain) }</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
      )
    case 'depository_migration_preparation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_migration_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_migration_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_migration_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Cipher public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.migration_cipher_public_key || 'none');
                AlertBox.open(AlertType.Info, 'Cipher public key copied!')
              }}>{ Readability.toHash(transaction.migration_cipher_public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_migration_commitment':
      return (
        <>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>Parent hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.depository_migration_preparation_hash);
                  AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                }}>{ Readability.toHash(transaction.depository_migration_preparation_hash) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/transaction/' + transaction.depository_migration_preparation_hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            transaction.encrypted_migrations.map((item: any, index: number) =>
              <Card key={item.account_hash + index} mt="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Account hash:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.account_hash);
                        AlertBox.open(AlertType.Info, 'Account hash copied!')
                      }}>{ Readability.toHash(item.account_hash) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Encrypted mpc seed:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.encrypted_mpc_seed);
                        AlertBox.open(AlertType.Info, 'Encrypted mpc seed copied!')
                      }}>{ Readability.toHash(item.encrypted_mpc_seed) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    case 'depository_migration_finalization':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_migration_commitment_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_migration_commitment_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_migration_commitment_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color="red">{ transaction.successful ? 'Migration successful' : 'Migration error' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    default:
      return <Text size="1" color="gray">No additional input fields</Text>
  }
}
function OutputFields(props: { orientation: 'horizontal' | 'vertical', state: SummaryState, events: any[] | null }) {
  const state = props.state;
  const events: { event: BigNumber, args: any[] }[] = (props.events || []).filter((event) => {
    switch (event.event.toNumber()) {
      case Types.AccountBalance:
      case Types.DepositoryBalance:
      case Types.DepositoryPolicy:
      case Types.WitnessAccount:
      case Types.WitnessTransaction:
      case Types.Rollup:
      case Types.DepositoryAccount:
      case Types.DepositoryMigration:
        return false;
      default:
        return true;
    }
  });
  return (
    <>
      {
        Object.entries(state.account.balances).map((inputs) => {
          const address = inputs[0];
          return Object.entries(inputs[1]).map((data) => {
            const event = data[1];
            return (
              <Card key={'Y0' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="blue">Transfer</Badge>
                    </DataList.Value>
                  </DataList.Item>
                  {
                    !event.supply.eq(0) &&
                    <>
                      <DataList.Item>
                        <DataList.Label>{event.supply.gte(0) ? 'To' : 'From' } account:</DataList.Label>
                        <DataList.Value>
                          <Button size="2" variant="ghost" color="indigo" onClick={() => {
                            navigator.clipboard.writeText(address);
                            AlertBox.open(AlertType.Info, 'Address copied!')
                          }}>{ Readability.toAddress(address) }</Button>
                          <Box ml="2">
                            <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                          </Box>
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Value:</DataList.Label>
                        <DataList.Value>{ Readability.toMoney(event.asset, event.supply) }</DataList.Value>
                      </DataList.Item>
                    </>
                  }
                  {
                    !event.reserve.eq(0) &&
                    <>
                      {
                        (event.supply.eq(0) || (event.supply.gte(0) && event.reserve.lt(0))) &&
                        <DataList.Item>
                          <DataList.Label>{event.reserve.gte(0) ? 'From' : 'To' } account:</DataList.Label>
                          <DataList.Value>
                            <Button size="2" variant="ghost" color="indigo" onClick={() => {
                              navigator.clipboard.writeText(address);
                              AlertBox.open(AlertType.Info, 'Address copied!')
                            }}>{ Readability.toAddress(address) }</Button>
                            <Box ml="2">
                              <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                            </Box>
                          </DataList.Value>
                        </DataList.Item>
                      }
                      <DataList.Item>
                        <DataList.Label>{event.reserve.gte(0) ? 'Lock' : 'Unlock' } value:</DataList.Label>
                        <DataList.Value>{ Readability.toMoney(event.asset, event.reserve.abs()) }</DataList.Value>
                      </DataList.Item>
                    </>
                  }
                </DataList.Root>
              </Card>
            )
          })
        })
      }
      {
        Object.entries(state.depository.balances).map((inputs) => {
          const address = inputs[0];
          return Object.entries(inputs[1]).map((data) => {
            const event = data[1];
            return (
              <Card key={'Y1' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="blue">Depository transfer</Badge>
                    </DataList.Value>
                  </DataList.Item>
                <DataList.Item>
                  <DataList.Label>{event.supply.gte(0) ? 'To' : 'From' } depository:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(address);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(address) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Value:</DataList.Label>
                  <DataList.Value>{ Readability.toMoney(event.asset, event.supply) }</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
            )
          })
        })
      }
      {
        Object.entries(state.depository.accounts).map((inputs) => {
          const address = inputs[0];
          return Object.entries(inputs[1]).map((data) => {
            const event = data[1];
            return (
              <Card key={'Y2' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="blue">Depository account</Badge>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Depository account:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(address) }</Button>
                      <Box ml="2">
                        <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                      </Box>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Depository asset:</DataList.Label>
                    <DataList.Value>{ event.asset.chain }</DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Depository accounts:</DataList.Label>
                    <DataList.Value>{ Readability.toCount('new account', event.newAccounts, true) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          })
        })
      }
      {
        Object.entries(state.depository.queues).map((inputs) => {
          const address = inputs[0];
          return Object.entries(inputs[1]).map((data) => {
            const event = data[1];
            return (
              <Card key={'Y3' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="blue">Depository queue</Badge>
                    </DataList.Value>
                  </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Depository account:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(address);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(address) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Depository asset:</DataList.Label>
                  <DataList.Value>{ event.asset.chain }</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Transaction hash:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(event.transactionHash || 'NULL');
                      AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                    }}>{ event.transactionHash ? Readability.toHash(event.transactionHash) : 'NULL' }</Button>
                    {
                      event.transactionHash &&
                      <Box ml="2">
                        <Link className="router-link" to={'/transaction/' + event.transactionHash}>▒▒</Link>
                      </Box>
                    }
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
            )
          })
        })
      }
      {
        Object.entries(state.depository.policies).map((inputs) => {
          const address = inputs[0];
          return Object.entries(inputs[1]).map((data) => {
            const event = data[1];
            return (
              <Card key={'Y4' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="blue">Depository policy</Badge>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Depository account:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(address) }</Button>
                      <Box ml="2">
                        <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                      </Box>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Depository asset:</DataList.Label>
                    <DataList.Value>{ event.asset.chain }</DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Security level:</DataList.Label>
                    <DataList.Value>Requires { Readability.toCount('participant', event.securityLevel) }</DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Account requests:</DataList.Label>
                    <DataList.Value>
                      <Badge color={ event.acceptsAccountRequests ? 'green' : 'red' }>{ event.acceptsAccountRequests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Withdrawal requests:</DataList.Label>
                    <DataList.Value>
                      <Badge color={ event.acceptsWithdrawalRequests ? 'green' : 'red' }>{ event.acceptsWithdrawalRequests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          })
        })
      }
      {
        Object.entries([...state.depository.mpc]).map((inputs) => {
          const address = inputs[1];
          return (
            <Card key={'Y5' + address} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="blue">Depository MPC</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Account:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(address);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(address) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        Object.entries(state.witness.accounts).map((inputs) => {
          const address = inputs[0];
          const event = inputs[1];
          return (
            <Card key={'Y6' + address + event.asset.handle} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="blue">Witness account</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Account:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(address);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(address) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/account/' + address}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
                {
                  event.aliases.map((item, index) =>
                    <DataList.Item key={address + event.asset.handle + item}>
                      <DataList.Label>Address v{event.aliases.length - index}:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(item);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(item) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  )
                }
                <DataList.Item>
                  <DataList.Label>Address type:</DataList.Label>
                  <DataList.Value>
                    <Badge color="jade">{ event.purpose }</Badge>
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        Object.entries(state.witness.transactions).map((inputs) => {
          const address = inputs[0];
          const event = inputs[1];
          return (
            <Card key={'Y7' + address + event.asset.handle} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="blue">Witness transaction</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Blockchain:</DataList.Label>
                  <DataList.Value>{ event.asset.chain }</DataList.Value>
                </DataList.Item>
                {
                  event.transactionIds.map((item) =>
                    <DataList.Item key={address + event.asset.handle + item}>
                      <DataList.Label>Transaction id:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(item);
                          AlertBox.open(AlertType.Info, 'Transaction id copied!')
                        }}>{ Readability.toHash(item) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  )
                }
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        Object.entries(state.receipts).map((inputs) => {
          const transactionHash = inputs[0];
          const event = inputs[1];
          return (
            <Card key={'Y8' + transactionHash + event.relativeGasUse.toString()} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="tomato">Rollup transaction</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Transaction hash:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(transactionHash);
                      AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                    }}>{ Readability.toHash(transactionHash) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/transaction/' + transactionHash}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Relative gas use:</DataList.Label>
                  <DataList.Value>{ Readability.toGas(event.relativeGasUse) }</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Relative gas paid:</DataList.Label>
                  <DataList.Value>{ Readability.toGas(event.relativeGasPaid) }</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        state.errors.map((message, index) => {
          return (
            <Card key={'Y9' + index} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="red">Execution error</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Message:</DataList.Label>
                  <DataList.Value>{ message?.toString() || 'none' }</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        events.map((event, index) => {
          const args = JSON.stringify(event.args.length > 1 ? event.args : event.args[0], null, 2);
          return (
            <Card key={'Y10' + event.event.toString() + index} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge>0x{ event.event.toString(16) }</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item key={index}>
                  <DataList.Label>Arguments:</DataList.Label>
                  <DataList.Value>
                    <Code color="tomato" wrap="balance" size="1" variant="soft" style={{ whiteSpace: 'pre-wrap' }}>
                      <Box px="1" py="1">{ args }</Box>
                    </Code>
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
    </>
  )
}

export default function Transaction(props: { ownerAddress: string, transaction: any, receipt?: any, state?: SummaryState, open?: boolean }) {
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const ownerAddress = props.ownerAddress;
  const time = receipt ? receipt.finalization_time.minus(receipt.generation_time).toNumber() : new Date().getTime();
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const aggregation = transaction.category == 'aggregation';
  const [consensus, setConsensus] = aggregation ? useState<{ branch: string, threshold: BigNumber, progress: BigNumber, committee: BigNumber, reached: boolean } | null>(null) : [undefined, undefined];
  if (receipt != null && receipt.block_number.gt(Netstat.blockTipNumber))
    Netstat.blockTipNumber = receipt.block_number;

  return (
    <Card variant="surface" mt="4">
      <Collapsible.Root open={props.open}>
        <Flex gap="3">
          <Avatar mt="1" size="2" radius="full" fallback={(transaction.asset.token || transaction.asset.chain)[0]} src={'/cryptocurrency/' + (transaction.asset.token || transaction.asset.chain).toLowerCase() + '.svg'} />
          <Box width="100%">
            <Flex justify="between" align="center" mb="1">
              <Text as="div" size="2" weight="bold">{ Readability.toTransactionType(transaction.type) }</Text>
              <Collapsible.Trigger asChild={true}>
                <Button size="1" radius="large" variant="soft" color="gray">
                  { receipt && <Text mr="-1" as="div" size="1" weight="light" color="gray">{ new Date(receipt.finalization_time.toNumber()).toLocaleTimeString() }</Text> }
                  { !receipt && <Spinner /> }
                  <Box ml="1">
                    <DropdownMenu.TriggerIcon />
                  </Box>
                </Button>
              </Collapsible.Trigger>
            </Flex>
            {
              state != null &&
              <Flex gap="2" wrap="wrap">
                {
                  state.errors.length > 0 &&
                  <Badge size="1" radius="medium" color="red">{ Readability.toCount('execution error', state.errors.length) }</Badge>
                }
                {
                  state.account.balances[ownerAddress] && Object.keys(state.account.balances[ownerAddress]).map((asset) => {
                    const value = state.account.balances[ownerAddress][asset];
                    return (
                      <Flex key={'X0' + transaction.hash + asset} gap="2">
                        { !value.supply.eq(0) && <Badge size="1" radius="medium" color={value.supply.gt(0) ? 'green' : (value.supply.isNegative() ? 'red' : 'gray')} style={{ textTransform: 'uppercase' }}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge> }
                        { !value.reserve.eq(0) && <Badge size="1" radius="medium" color="blue" style={{ textTransform: 'uppercase' }}>{ Readability.toMoney(value.asset, value.reserve.negated(), true) }</Badge> }
                      </Flex>
                    )
                  })
                }
                {
                  state.depository.balances[ownerAddress] && Object.keys(state.depository.balances[ownerAddress]).map((asset) => {
                    const value = state.depository.balances[ownerAddress][asset];
                    return (
                      <Badge key={'X1' + transaction.hash + asset} size="1" radius="medium" color={value.supply.eq(0) ? 'gray' : 'lime'} style={{ textTransform: 'uppercase' }}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge>
                    )
                  })
                }
                {
                  Object.entries(state.depository.queues).map((data) => {
                    return Object.entries(state.depository.queues[data[0]]).map((inputs) => {
                      const event = inputs[1];
                      const transactionHash = event.transactionHash || transaction.depository_withdrawal_hash || transaction.hash;
                      const locking = event.transactionHash != null;
                      return <Badge key={'X2' + event.asset.handle + transactionHash} size="1" radius="medium" color="yellow">{ locking ? '+' : '-' }{ Readability.toAddress(transactionHash) }</Badge>
                    })
                  })
                }
                {
                  Object.keys(state.witness.accounts).map((asset) => {
                    const aliases = state.witness.accounts[asset].aliases;
                    return aliases.map((alias) => <Badge key={'X3' + alias} size="1" radius="medium" color="green">+{ Readability.toAddress(alias) }</Badge>)
                  })
                }
                {
                  Object.keys(state.witness.transactions).map((asset) => {
                    const event = state.witness.transactions[asset];
                    return event.transactionIds.map((tx) => <Badge key={'X4' + event.asset.toHex() + tx} size="1" radius="medium" color="gold">@{ Readability.toAddress(tx) }</Badge>)
                  })
                }
                {
                  Object.keys(state.receipts).length > 0 &&
                  <Badge size="1" radius="medium" color="gold">{ Readability.toCount('receipt', Object.keys(state.receipts).length) }</Badge>
                }
                {
                  Object.keys(state.depository.accounts).length > 0 &&
                  <Badge size="1" radius="medium" color="green">{ Readability.toCount('account', Object.keys(state.depository.accounts).length, true) }</Badge>
                }
                {
                  Object.keys(state.depository.policies).length > 0 &&
                  <Badge size="1" radius="medium" color="green">{ Readability.toCount('change', Object.keys(state.depository.policies).length) }</Badge>
                }
                {
                  state.depository.mpc.size > 0 &&
                  <Badge size="1" radius="medium" color="green">{ Readability.toCount('participant', state.depository.mpc.size) }</Badge>
                }
                {
                  InterfaceUtil.isSummaryStateEmpty(state, ownerAddress) &&
                  <Badge size="1" radius="medium" color="gray">{ receipt.successful ? 'Transaction executed successfully' : 'Transaction execution failed' }</Badge>
                }
              </Flex>
            }
            {
              state == null &&
              <Flex gap="2" wrap="wrap" justify="between">
                <Badge size="1" radius="medium" color="gray">Awaiting state finalization</Badge>
              </Flex>
            }
          </Box>
        </Flex>
        <Collapsible.Content>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Transaction hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.hash);
                  AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                }}>{ Readability.toHash(transaction.hash) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/transaction/' + transaction.hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Signature:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.signature);
                  AlertBox.open(AlertType.Info, 'Transaction signature copied!')
                }}>{ Readability.toHash(transaction.signature) }</Button>
              </DataList.Value>
            </DataList.Item>
            {
              receipt &&
              <>
                <DataList.Item>
                  <DataList.Label>Status:</DataList.Label>
                  <DataList.Value>
                    <Badge color={receipt.successful ? 'green' : 'red'}>{ Readability.toTransactionType(transaction.type) } { receipt.successful ? 'finalized' : 'reverted' } in { Readability.toTimespan(time) }</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Timestamp:</DataList.Label>
                  <DataList.Value>{ new Date(receipt.generation_time.toNumber()).toLocaleString() }</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Block:</DataList.Label>
                  <DataList.Value>
                    { receipt.block_number.toString() }
                    <Box ml="2">
                      <Link className="router-link" to={'/block/' + receipt.block_number.toString()}>▒▒</Link>
                    </Box>
                  </DataList.Value>
                </DataList.Item>
                {
                  Netstat.blockTipNumber != null &&
                  <DataList.Item>
                    <DataList.Label>Confidence:</DataList.Label>
                    <DataList.Value>
                      <Badge color={Netstat.blockTipNumber.minus(receipt.block_number).gt(0) ? 'green' : 'orange'}>{ Readability.toCount('confirmation', Netstat.blockTipNumber.minus(receipt.block_number)) }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                }
              </>
            }
            {
              !receipt &&
              <DataList.Item>
                <DataList.Label>Status:</DataList.Label>
                <DataList.Value>
                  <Badge color="yellow">Not included a in block</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Paying account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(receipt?.from || ownerAddress);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(receipt?.from || ownerAddress) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + (receipt?.from || ownerAddress)}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Sequence:</DataList.Label>
              <DataList.Value>0x{ transaction.sequence.toString(16) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Category:</DataList.Label>
              <DataList.Value>
                <Badge color="gray">{ Readability.toTransactionCategory(transaction.category) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas price:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.gas_price) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas limit:</DataList.Label>
              <DataList.Value>{ Readability.toGas(transaction.gas_limit) }</DataList.Value>
            </DataList.Item>
            {
              receipt &&
              <>
                <DataList.Item>
                  <DataList.Label>Gas use:</DataList.Label>
                  <DataList.Value>{ Readability.toGas(receipt.relative_gas_use) } | { (receipt.relative_gas_use.div(transaction.gas_limit).toNumber() * 100).toFixed(2) }%</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Fee paid:</DataList.Label>
                  <DataList.Value>{ Readability.toMoney(transaction.asset, receipt.relative_gas_paid.multipliedBy(transaction.gas_price)) }</DataList.Value>
                </DataList.Item>
              </>
            }
          </DataList.Root>
          {
            aggregation && state == null &&
            <>
              <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
              <DataList.Root orientation={orientation}>
                {
                  consensus == null &&
                  <DataList.Item>
                    <DataList.Label>Attestation progress:</DataList.Label>
                    <DataList.Value>
                      <Button size="1" variant="outline" color="yellow" onClick={async () => {
                        try {
                          const consensusData = await Interface.getMempoolCumulativeConsensus(transaction.hash);
                          if (setConsensus != null && consensusData != null)
                            setConsensus(consensusData);
                        } catch {
                          AlertBox.open(AlertType.Error, 'Failed to fetch transaction consensus info');
                        }
                      }}>Fetch consensus info</Button>
                    </DataList.Value>
                  </DataList.Item>
                }
                {
                  consensus != null &&
                  <>
                    <DataList.Item>
                      <DataList.Label>Best assertion:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(consensus.branch);
                          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                        }}>{ Readability.toHash(consensus.branch) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Attestation committee:</DataList.Label>
                      <DataList.Value>{ Readability.toCount('proposer', consensus.committee) }</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Attestations acquired:</DataList.Label>
                      <DataList.Value>
                        <Text color="yellow">{ (consensus.progress.toNumber() * 100).toFixed(2) }%</Text>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Required attestations:</DataList.Label>
                      <DataList.Value>
                        <Text color="red">{ (consensus.threshold.toNumber() * 100).toFixed(2) }%</Text>
                      </DataList.Value>
                    </DataList.Item>
                  </>
                }
              </DataList.Root>
            </>
          }
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <InputFields orientation={orientation} transaction={transaction}></InputFields>
          {
            state != null && (!InterfaceUtil.isSummaryStateEmpty(state) || (receipt && receipt.events.length > 0)) &&
            <>
              <Box mt="4" mb="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
              <OutputFields orientation={orientation} state={state} events={receipt ? receipt.events : null}></OutputFields>
            </>
          }
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  )
}