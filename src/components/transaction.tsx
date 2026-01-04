import { Avatar, Badge, Box, Button, Card, Code, DataList, DropdownMenu, Flex, Spinner, Text } from "@radix-ui/themes";
import { EventResolver, SummaryState, AssetId, Readability, EventType } from 'tangentsdk';
import { AlertBox, AlertType } from "./alert";
import { Link } from "react-router";
import { AppData } from "../core/app";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";

function InputFields(props: { orientation: 'horizontal' | 'vertical', transaction: any }) {
  const transaction = props.transaction;
  switch (transaction.type) {
    case 'transfer':
      return transaction.to.map((item: any, index: number) =>
        <Card key={'IF0' + item.to + index} mb={index == transaction.to.length - 1 ? '0' : '4'}>
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
          </DataList.Root>
        </Card>
      )
    case 'deploy': {
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Using:</DataList.Label>
            <DataList.Value>
              <Badge color="red">{ transaction.from[0] + transaction.from.substring(1) }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Program:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.callable);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.callable) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/account/' + transaction.callable}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Bundle:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.data);
                AlertBox.open(AlertType.Info, 'Program calldata copied!')
              }}>{ Readability.toHash(transaction.data) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                const data: any = JSON.stringify(transaction.args, null, 2);
                navigator.clipboard.writeText(data);
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toHash(args) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    }
    case 'call': {
      const method = transaction.function.match(/[\(\)]/) != null ? transaction.function : ('address_of(@' + transaction.function + ')');
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Program:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.callable);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.callable) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/account/' + transaction.callable}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Function:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="jade" onClick={() => {
                navigator.clipboard.writeText(method);
                AlertBox.open(AlertType.Info, 'Program function copied!')
              }}>{ Readability.toHash(method, 20) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toHash(args, 20) }</Button>
            </DataList.Value>
          </DataList.Item>
          {
            Array.isArray(transaction.pays) && transaction.pays.map((item: any) =>
              <DataList.Item key={item.asset.id}>
                <DataList.Label>Value paid:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(item.asset, item.value) }</DataList.Value>
              </DataList.Item>)
          }
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
                <Flex align="center" gap="2" key={'IF1' + item.hash + index} mb={index == transaction.transactions.length - 1 ? '0' : '4'}>
                  <Avatar size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
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
    case 'setup':
      return (
        <>
          <DataList.Root orientation={props.orientation}>
            {
              transaction.block_production !== undefined &&
              <DataList.Item>
                <DataList.Label>Block production:</DataList.Label>
                <DataList.Value>
                  <Badge color={ transaction.block_production != null ? 'jade' : 'red' }>{ transaction.block_production != null ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.block_production) + ' locked' : 'Offline' }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.bridge_participation !== undefined &&
              <DataList.Item>
                <DataList.Label>Bridge participation:</DataList.Label>
                <DataList.Value>
                  <Badge color={ transaction.bridge_participation != null ? 'jade' : 'red' }>{ transaction.bridge_participation != null ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.bridge_participation) + ' locked' : 'Offline' }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
          </DataList.Root>
          {
            transaction.attestations != null && transaction.attestations.map((item: any) => 
              <Card key={'IF3' + item.asset.chain} mt="4">
                <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>{ item.asset.chain } attestation stake:</DataList.Label>
                  <DataList.Value>
                    <Badge color={ item.stake != null ? 'jade' : 'red' }>{ item.stake != null ? 'Online with ' + Readability.toMoney(new AssetId(), item.stake) : 'Offline' }</Badge>
                  </DataList.Value>
                </DataList.Item>
                {
                  item.security_level != null &&
                  <DataList.Item>
                    <DataList.Label>Security level:</DataList.Label>
                    <DataList.Value>Requires { Readability.toCount('participant', item.security_level) }</DataList.Value>
                  </DataList.Item>
                }
                {
                  item.participation_threshold != null &&
                  <DataList.Item>
                    <DataList.Label>Participation threshold:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.participation_threshold) }</DataList.Value>
                  </DataList.Item>
                }
                {
                  item.incoming_fee != null &&
                  <DataList.Item>
                    <DataList.Label>Deposit fee:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.incoming_fee) }</DataList.Value>
                  </DataList.Item>
                }
                {
                  item.outgoing_fee != null &&
                  <DataList.Item>
                    <DataList.Label>Withdrawal fee:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.outgoing_fee) }</DataList.Value>
                  </DataList.Item>
                }
                {
                  item.accepts_account_requests != null &&
                  <DataList.Item>
                    <DataList.Label>Account requests:</DataList.Label>
                    <DataList.Value>
                      <Badge color={ item.accepts_account_requests ? 'jade' : 'red' }>{ item.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                }
                {
                  item.accepts_account_requests != null &&
                  <DataList.Item>
                    <DataList.Label>Withdrawal requests:</DataList.Label>
                    <DataList.Value>
                      <Badge color={ item.accepts_withdrawal_requests ? 'jade' : 'red' }>{ item.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                }
              </DataList.Root>
            </Card>
            )
          }
          {
            transaction.bridge_migrations != null && transaction.bridge_migrations.map((item: any, index: number) =>
              <Card key={'IF7' + item.broadcast_hash + index} mt="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Reasoning transaction hash:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.broadcast_hash);
                        AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                      }}>{ Readability.toHash(item.broadcast_hash) }</Button>
                      <Box ml="2">
                        <Link className="router-link" to={'/transaction/' + item.broadcast_hash}>▒▒</Link>
                      </Box>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Participant account:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.participant);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.participant) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    case 'migrate':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.setup_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.setup_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.setup_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Proof signature:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.proof || 'NULL');
                AlertBox.open(AlertType.Info, 'Proof signature copied!')
              }}>{ Readability.toHash(transaction.proof) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'attestate': {
      if (transaction.proof != null) {
        const from = transaction.proof.inputs.map((item: any) => {
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
        const to = transaction.proof.outputs.map((item: any) => {
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
                    navigator.clipboard.writeText(transaction.proof.transaction_id);
                    AlertBox.open(AlertType.Info, 'Transaction id copied!')
                  }}>{ Readability.toHash(transaction.proof.transaction_id) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Block id:</DataList.Label>
                <DataList.Value>{ transaction.proof.block_id?.toString() || 'NULL' }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
            {
              from.map((item: any, index: number) =>
                <Card key={'IF5' + item.address + index} mb="4">
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
                <Card key={'IF6' + item.address + index} mb="4">
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
      } else {
        return (
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>Input hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.commitment.input_hash);
                  AlertBox.open(AlertType.Info, 'Input hash copied!')
                }}>{ Readability.toHash(transaction.commitment.input_hash) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Output hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.commitment.output_hash);
                  AlertBox.open(AlertType.Info, 'Output hash copied!')
                }}>{ Readability.toHash(transaction.commitment.output_hash) }</Button>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        )
      }
    }
    case 'route':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Delegation account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" disabled={!transaction.manager} onClick={() => {
                navigator.clipboard.writeText(transaction.manager || 'NULL');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.manager) }</Button>
              {
                transaction.manager &&
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + transaction.manager}>▒▒</Link>
                </Box>
              }
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'bind':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.route_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.route_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.route_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Group public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.group_public_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Group public key copied!')
              }}>{ Readability.toHash(transaction.group_public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Group signature:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.group_signature || 'NULL');
                AlertBox.open(AlertType.Info, 'Group signature copied!')
              }}>{ Readability.toHash(transaction.group_signature) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'withdraw':
      return (
        <DataList.Root orientation={props.orientation} mb="4">
          {
            transaction.manager &&
            <DataList.Item>
              <DataList.Label>From manager:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.manager || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(transaction.manager) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + transaction.manager}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
          }
          {
            transaction.to_address &&
            <DataList.Item>
              <DataList.Label>To address:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.to_address);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(transaction.to_address) }</Button>
              </DataList.Value>
            </DataList.Item>
          }
          {
            transaction.to_value &&
            <DataList.Item>
              <DataList.Label>Value:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.to_value) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>Execution policy:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.only_if_not_in_queue ? 'red' : 'orange' }>{ transaction.only_if_not_in_queue ? 'Immediate or cancel' : 'Can wait in queue' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'broadcast':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.withdraw_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.withdraw_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.withdraw_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.hashdata && transaction.calldata && transaction.prepared &&
            <>
              <DataList.Item>
                <DataList.Label>Off-chain hash:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.hashdata);
                    AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                  }}>{ Readability.toHash(transaction.hashdata) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Off-chain data:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify({
                      internal: transaction.prepared,
                      transaction_hash: transaction.hashdata,
                      transaction_data: transaction.calldata,
                      locktime: transaction.locktime
                    }, null, 2));
                    AlertBox.open(AlertType.Info, 'ABI data copied!')
                  }}>Copy ABI data</Button>
                </DataList.Value>
              </DataList.Item>
            </>
          }
          {
            transaction.error &&
            <DataList.Item>
              <DataList.Label>Off-chain relay:</DataList.Label>
              <DataList.Value>
                <Code color="tomato" wrap="balance" size="1" variant="soft" style={{ whiteSpace: 'pre', maxWidth: '340px' }}>
                  <Box px="1" py="1">FAULT { transaction.error }</Box>
                </Code>
              </DataList.Value>
            </DataList.Item>
          }
        </DataList.Root>
      )
    case 'anticast':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.broadcast_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.broadcast_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.broadcast_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    default:
      return <Text size="1" color="gray">No additional input fields</Text>
  }
}
function OutputFields(props: { orientation: 'horizontal' | 'vertical', state: SummaryState }) {
  const state = props.state;
  return (
    <>
      {
        state.events.map((event, index) => {
          switch (event.type) {
            case EventType.Error: {
              return (
                <Card key={'OF0' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="red">Execution error</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Message:</DataList.Label>
                      <DataList.Value>{ event.message?.toString() || 'NULL' }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.Transfer: {
              return (
                <Card key={'OF1' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="teal">Transfer</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>From account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.from);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.from) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.from}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>To account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.to);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.to) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.to}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Value:</DataList.Label>
                      <DataList.Value>{ Readability.toMoney(event.asset, event.value, true) }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.TransferIsolated: {
              return (
                <Card key={'OF2' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="teal">Supply transfer</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>{ event.supply.gt(0) ? 'To' : 'From' } account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    {
                      !event.supply.eq(0) &&
                      <DataList.Item>
                        <DataList.Label>Value:</DataList.Label>
                        <DataList.Value>{ Readability.toMoney(event.asset, event.supply, true) }</DataList.Value>
                      </DataList.Item>
                    }
                    {
                      !event.reserve.eq(0) &&
                      <DataList.Item>
                        <DataList.Label>{event.reserve.gte(0) ? 'Lock' : 'Unlock' } value:</DataList.Label>
                        <DataList.Value>{ Readability.toMoney(event.asset, event.reserve.abs(), true) }</DataList.Value>
                      </DataList.Item>
                    }
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.TransferFee: {
              return (
                <Card key={'OF3' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="teal">Fee transfer</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>{ event.fee.gt(0) ? 'To' : 'From' } account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Fee value:</DataList.Label>
                      <DataList.Value>{ Readability.toMoney(event.asset, event.fee, true) }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeTransfer: {
              return (
                <Card key={'OF4' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge transfer</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>{ event.value.gt(0) ? 'To' : 'From' } account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Value:</DataList.Label>
                      <DataList.Value>{ Readability.toMoney(event.asset, event.value, true) }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeAccount: {
              return (
                <Card key={'OF5' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge account</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge asset:</DataList.Label>
                      <DataList.Value>{ event.asset.chain }</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Managing:</DataList.Label>
                      <DataList.Value>{ Readability.toCount('account', event.accounts, true) }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeQueue: {
              return (
                <Card key={'OF6' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge queue</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge asset:</DataList.Label>
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
            }
            case EventType.BridgePolicy: {
              return (
                <Card key={'OF7' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge policy</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeParticipant: {
              return (
                <Card key={'OF8' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge participant</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Selected account:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.owner);
                          AlertBox.open(AlertType.Info, 'Address copied!')
                        }}>{ Readability.toAddress(event.owner) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/account/' + event.owner}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.WitnessAccount: {
              return (
                <Card key={'OF9' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="teal">Witness account</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    {
                      event.addresses.map((item, index) =>
                        <DataList.Item key={'OF10' + event.addresses[0] + event.asset.handle + item}>
                          <DataList.Label>Address v{event.addresses.length - index}:</DataList.Label>
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
                        <Badge color="jade">{ event.purpose[0].toUpperCase() + event.purpose.substring(1) } account</Badge>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.WitnessTransaction: {
              return (
                <Card key={'OF11' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="teal">Witness transaction</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Blockchain:</DataList.Label>
                      <DataList.Value>{ event.asset.chain }</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>State hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.stateHash);
                          AlertBox.open(AlertType.Info, 'State hash copied!')
                        }}>{ Readability.toHash(event.stateHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.RollupReceipt: {
              return (
                <Card key={'OF12' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Rollup receipt</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Transaction hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.transactionHash);
                          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                        }}>{ Readability.toHash(event.transactionHash) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/transaction/' + event.transactionHash}>▒▒</Link>
                        </Box>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Execution index:</DataList.Label>
                      <DataList.Value>{ event.executionIndex.toString() }</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Relative gas use:</DataList.Label>
                      <DataList.Value>{ Readability.toGas(event.relativeGasUse) }</DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.Unknown:
            default: {
              let copy = event as { type: EventType.Unknown; event: BigNumber; args: any[]; }
              return (
                <Card key={'OF13' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge>0x{ copy.event.toString(16) }</Badge>
                        <Badge color="yellow" ml="1">Non-standard</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    {
                      copy.args != null &&
                      <DataList.Item key={index}>
                        <DataList.Label>Body:</DataList.Label>
                        <DataList.Value>
                          <Code color="tomato" wrap="balance" size="1" variant="soft" style={{ whiteSpace: 'pre' }}>
                            <Box px="1" py="1">{ JSON.stringify(copy.args, null, 1) }</Box>
                          </Code>
                        </DataList.Value>
                      </DataList.Item>
                    }
                  </DataList.Root>
                </Card>
              )
            }
          }
        })
      }
    </>
  )
}

export default function Transaction(props: { ownerAddress: string, transaction: any, receipt?: any, state?: SummaryState, open?: boolean, preview?: string | boolean }) {
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const ownerAddress = props.ownerAddress;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  if (!props.preview && receipt != null && (!AppData.tip || receipt.block_number.gt(AppData.tip)))
    AppData.tip = receipt.block_number;

  return (
    <Card variant="surface" mt="4" style={{ borderRadius: '22px' }}>
      <Collapsible.Root open={props.open}>
        <Flex gap="3" align="start">
          <Avatar size="3" mt="1" radius="full" fallback={Readability.toAssetFallback(transaction.asset)} src={Readability.toAssetImage(transaction.asset)} />
          <Box width="100%">
            <Flex justify="between" align="center" mb="1">
              <Text as="div" size="2" weight="bold">{ transaction.type == 'call' && transaction.function != null ? Readability.toFunctionName(transaction.function) : Readability.toTransactionType(transaction.type) }</Text>       
              <Collapsible.Trigger asChild={true}>
                <Button size="1" radius="large" variant="soft" color={props.preview ? 'yellow' : 'gray'}>
                  { !props.preview && receipt && <Text mr="-1" as="div" size="1" weight="light" color="gray">{ receipt.block_time ? new Date(receipt.block_time.toNumber()).toLocaleTimeString() : 'NULL' }</Text> }
                  { !props.preview && !receipt && <Spinner /> }
                  { props.preview && <Text mr="-1" as="div" size="1" weight="light" color="yellow">Preview!</Text> }
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
                  !transaction.error && EventResolver.isSummaryStateEmpty(state, ownerAddress) &&
                  <Badge size="1" radius="medium" color={receipt.successful ? 'jade' : 'red'}>{ receipt.successful ? (receipt.events.length > 0 ? Readability.toCount('event', receipt.events.length) : 'Successful') : 'Rollback' }</Badge>
                }
                {
                  transaction.error != null &&
                  <Badge size="1" radius="medium" color="red">Refund</Badge>
                }
                {
                  state.errors.length > 0 &&
                  <Badge size="1" radius="medium" color="red">{ Readability.toCount('execution error', state.errors.length) }</Badge>
                }
                {
                  state.account.balances[ownerAddress] && Object.keys(state.account.balances[ownerAddress]).map((asset) => {
                    const value = state.account.balances[ownerAddress][asset];
                    const zero = value.supply.eq(0) && value.reserve.eq(0);
                    return (
                      <Flex key={'X0' + transaction.hash + asset} gap="2">
                        { (zero || !value.supply.eq(0)) && <Badge size="1" radius="medium" color={value.supply.gt(0) ? 'jade' : (value.supply.isNegative() ? 'red' : 'gray')}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge> }
                        { !value.reserve.eq(0) && <Badge size="1" radius="medium" color="yellow">{ Readability.toMoney(value.asset, value.reserve.negated(), true) }</Badge> }
                      </Flex>
                    )
                  })
                }
                {
                  state.bridge.balances[ownerAddress] && Object.keys(state.bridge.balances[ownerAddress]).map((asset) => {
                    const value = state.bridge.balances[ownerAddress][asset];
                    return (
                      <Badge key={'X1' + transaction.hash + asset} size="1" radius="medium" color={value.supply.eq(0) ? 'gray' : 'brown'}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge>
                    )
                  })
                }
                {
                  Object.keys(state.witness.accounts).map((asset) => {
                    const aliases = state.witness.accounts[asset].aliases;
                    const bridge = state.witness.accounts[asset].purpose == 'bridge';
                    return aliases.map((alias) => <Badge key={'X3' + alias} size="1" radius="medium" color={bridge ? 'blue' : 'jade'}>{ Readability.toAddress(alias) }</Badge>)
                  })
                }
                {
                  Object.keys(state.bridge.migrations).length > 0 &&
                  <Badge size="1" radius="medium" color="yellow">Migrate { Readability.toCount('participant', Object.keys(state.bridge.migrations).length) }</Badge>
                }
                {
                  Object.keys(state.bridge.policies).length > 0 &&
                  <Badge size="1" radius="medium" color="yellow">{ Readability.toCount('change', Object.keys(state.bridge.policies).length) }</Badge>
                }
                {
                  Object.keys(state.bridge.accounts).length > 0 && !Object.keys(state.witness.accounts).length &&
                  <Badge size="1" radius="medium" color="brown">{ Readability.toCount('account', Object.keys(state.bridge.accounts).length, true) }</Badge>
                }
                {
                  state.bridge.participants.size > 0 &&
                  <Badge size="1" radius="medium" color="brown">{ Readability.toCount('participant', state.bridge.participants.size) }</Badge>
                }
                {
                  Object.keys(state.receipts).length > 0 &&
                  <Badge size="1" radius="medium" color="brown">{ Readability.toCount('receipt', Object.keys(state.receipts).length) }</Badge>
                }
                {
                  Object.entries(state.bridge.queues).map((data) => {
                    return Object.entries(state.bridge.queues[data[0]]).map((inputs) => {
                      const event = inputs[1];
                      const transactionHash = event.transactionHash || transaction.withdraw_hash || transaction.hash;
                      return <Badge key={'X2' + event.asset.handle + transactionHash} size="1" radius="medium" color="brown">{ Readability.toAddress(transactionHash, 4) }</Badge>
                    })
                  })
                }
                {
                  Object.keys(state.witness.transactions).map((asset) => {
                    const event = state.witness.transactions[asset];
                    return event.stateHashes.map((stateHash) => <Badge key={'X4' + event.asset.toHex() + stateHash} size="1" radius="medium" color="brown">{ Readability.toAddress(stateHash, 4) }</Badge>)
                  })
                }
              </Flex>
            }
            {
              state == null &&
              <Flex gap="2" wrap="wrap" justify="between">
                <Badge size="1" radius="medium" color={props.preview ? 'orange' : 'gray'}>{ props.preview ? (typeof props.preview == 'string' ? props.preview : 'Preview transaction!') : 'Pending transaction' }</Badge>
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
                }}>{ Readability.toHash(transaction.hash, 12) }</Button>
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
                }}>{ Readability.toHash(transaction.signature, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            {
              !props.preview && receipt &&
              <>
                <DataList.Item>
                  <DataList.Label>Status:</DataList.Label>
                  <DataList.Value>
                    <Badge color={receipt.successful ? 'jade' : 'red'}>Execution { receipt.successful ? 'finalized' : 'reverted' }</Badge>
                  </DataList.Value>
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
                  AppData.tip != null &&
                  <DataList.Item>
                    <DataList.Label>Confidence:</DataList.Label>
                    <DataList.Value>
                      <Badge color={AppData.tip.minus(receipt.block_number).gt(0) ? 'jade' : 'orange'}>{ Readability.toCount('confirmation', AppData.tip.minus(receipt.block_number).plus(1)) }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                }
              </>
            }
            {
              (props.preview || !receipt) &&
              <DataList.Item>
                <DataList.Label>Status:</DataList.Label>
                <DataList.Value>
                  <Badge color="yellow">Not included a in block</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            {
              receipt && 
              <DataList.Item>
                <DataList.Label>Timestamp:</DataList.Label>
                <DataList.Value>{ new Date(receipt.block_time.toNumber()).toLocaleString() }</DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Paying account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(receipt?.from || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(receipt?.from || 'NULL') }</Button>
                {
                  receipt?.from != null &&
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + receipt?.from}>▒▒</Link>
                  </Box>
                }
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Nonce:</DataList.Label>
              <DataList.Value>0x{ transaction.nonce.toString(16) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas network:</DataList.Label>
              <DataList.Value>{ Readability.toAssetName(transaction.asset, true) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas price:</DataList.Label>
              <DataList.Value>{ transaction.gas_price != null ? Readability.toMoney(transaction.asset, transaction.gas_price) : <Badge color="yellow">Consensus override</Badge> }</DataList.Value>
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
                {
                  transaction.gas_price != null &&
                  <DataList.Item>
                    <DataList.Label>Fee paid:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(transaction.asset, receipt.relative_gas_use.multipliedBy(transaction.gas_price)) }</DataList.Value>
                  </DataList.Item>
                }
              </>
            }
          </DataList.Root>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <InputFields orientation={orientation} transaction={transaction}></InputFields>
          {
            state != null && state.events.length > 0 &&
            <>
              <Box mt="4" mb="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
              <OutputFields orientation={orientation} state={state}></OutputFields>
            </>
          }
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  )
}