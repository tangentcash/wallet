import { Avatar, Badge, Box, Button, Card, Code, DataList, Flex, Spinner, Text } from "@radix-ui/themes";
import { EventResolver, SummaryState, AssetId, Readability, EventType } from 'tangentsdk';
import { AlertBox, AlertType } from "./alert";
import { Link } from "react-router";
import { AppData } from "../core/app";
import { useState } from "react";
import { mdiAlert, mdiBridge, mdiCheck, mdiInformationOutline, mdiKeyChange, mdiListBox, mdiLockOpenVariantOutline, mdiLockOutline, mdiReceiptTextCheck, mdiStateMachine, mdiVectorCurve, mdiVectorLink, mdiVectorSquareEdit } from "@mdi/js";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

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
            <DataList.Label>Strategy:</DataList.Label>
            <DataList.Value>
              <Badge color="yellow">Deploy from { transaction.from }</Badge>
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
            <DataList.Label>Source:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.data);
                AlertBox.open(AlertType.Info, 'Program calldata copied!')
              }}>{ Readability.toHash(transaction.data) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Calldata:</DataList.Label>
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
            <DataList.Label>Callable:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="jade" onClick={() => {
                navigator.clipboard.writeText(method);
                AlertBox.open(AlertType.Info, 'Program function copied!')
              }}>{ Readability.toHash(method, 20) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Calldata:</DataList.Label>
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
                <Flex align="center" gap="2" key={'IF1' + item.action.hash + index} mb={index == transaction.transactions.length - 1 ? '0' : '4'}>
                  <Avatar size="1" radius="full" fallback={Readability.toAssetFallback(item.action.asset)} src={Readability.toAssetImage(item.action.asset)} />
                  <Badge size="2" variant="soft">{ Readability.toTransactionType(item.action.type) }</Badge>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(item.action.hash);
                    AlertBox.open(AlertType.Info, 'Internal transaction hash copied!')
                  }}>{ Readability.toHash(item.action.hash) }</Button>
                  <Link className="router-link" to={'/transaction/' + item.action.hash}>▒▒</Link>
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
            <DataList.Item>
              <DataList.Label>Side effects on:</DataList.Label>
              <DataList.Value>
                <Flex gap="2" wrap="wrap">
                  { transaction.block_production !== undefined && <Badge size="1" color="amber">Block production</Badge> }
                  { transaction.bridge_participation !== undefined && <Badge size="1" color="amber">Bridge participation</Badge> }
                  { transaction.attestations != null && transaction.attestations.length > 0 && <Badge size="1" color="amber">Bridge attestation</Badge> }
                  { transaction.bridges != null && transaction.bridges.length > 0 && <Badge size="1" color="amber">Bridge allocation</Badge> }
                  { transaction.bridge_migrations != null && transaction.bridge_migrations.length > 0 && <Badge size="1" color="amber">Bridge migration</Badge> }
                </Flex>
              </DataList.Value>
            </DataList.Item>
            {
              transaction.block_production !== undefined &&
              <DataList.Item>
                <DataList.Label>Block production:</DataList.Label>
                <DataList.Value>
                  <Badge color={ typeof transaction.block_production == 'object' ? 'jade' : 'red' }>{ typeof transaction.block_production == 'object' ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.block_production) + ' locked' : 'Offline' }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.bridge_participation !== undefined &&
              <DataList.Item>
                <DataList.Label>Bridge participation:</DataList.Label>
                <DataList.Value>
                  <Badge color={ typeof transaction.bridge_participation == 'object' ? 'jade' : 'red' }>{ typeof transaction.bridge_participation == 'object' ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.bridge_participation) + ' locked' : 'Offline' }</Badge>
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
                  item.min_fee != null &&
                  <DataList.Item>
                    <DataList.Label>Min fee:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(item.asset, item.min_fee) }</DataList.Value>
                  </DataList.Item>
                }
              </DataList.Root>
            </Card>
            )
          }
          {
            transaction.bridges != null && transaction.bridges.map((item: any) => 
              <Card key={'IF113' + item.asset.chain} mt="4">
                <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Security level:</DataList.Label>
                  <DataList.Value>Requires { Readability.toCount('participant', item.security_level) }</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Fee rate:</DataList.Label>
                  <DataList.Value>{ Readability.toMoney(item.asset, item.fee_rate) }</DataList.Value>
                </DataList.Item>
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
    case 'route':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Bridge hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.bridge_hash);
                AlertBox.open(AlertType.Info, 'Bridge hash copied!')
              }}>{ Readability.toHash(transaction.bridge_hash) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Routing address:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.routing_address || 'NULL');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ transaction.routing_address ? Readability.toAddress(transaction.routing_address) : 'NULL' }</Button>
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
          <DataList.Item>
            <DataList.Label>Bridge hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.bridge_hash);
                AlertBox.open(AlertType.Info, 'Bridge hash copied!')
              }}>{ Readability.toHash(transaction.bridge_hash) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Address:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.address);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.address) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Value:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.value) }</DataList.Value>
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
    case 'attestate': {
      let signatures = 0;
      const commitments = Object.keys(transaction.commitments).length;
      for (let commitment in transaction.commitments)
        signatures += transaction.commitments[commitment].length;

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
                <DataList.Label>Off-chain block:</DataList.Label>
                <DataList.Value>{ transaction.proof.block_id?.toString() || 'NULL' }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Off-chain transaction:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.proof.transaction_id);
                    AlertBox.open(AlertType.Info, 'Transaction id copied!')
                  }}>{ Readability.toHash(transaction.proof.transaction_id) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>On-chain assurance:</DataList.Label>
                <DataList.Value>
                  <Badge color="orange">{ Readability.toCount('signature', signatures) } in { Readability.toCount('commitment', commitments) }</Badge>
                </DataList.Value>
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
              <DataList.Label>On-chain assurance:</DataList.Label>
              <DataList.Value>
                <Badge color="orange">{ Readability.toCount('signature', signatures) } in { Readability.toCount('commitment', commitments) }</Badge>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        )
      }
    }
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
            case EventType.BridgePolicy: {
              return (
                <Card key={'OF117' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge policy</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.bridgeHash);
                          AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                        }}>{ Readability.toHash(event.bridgeHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeTransaction: {
              return (
                <Card key={'OF744' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge transaction</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.bridgeHash);
                          AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                        }}>{ Readability.toHash(event.bridgeHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Nonce:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText('0x' + event.nonce.toString(16));
                          AlertBox.open(AlertType.Info, 'Transaction nonce copied!')
                        }}>{ '0x' + event.nonce.toString(16) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeAccount: {
              return (
                <Card key={'OF742' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge account</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.bridgeHash);
                          AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                        }}>{ Readability.toHash(event.bridgeHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Nonce:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText('0x' + event.nonce.toString(16));
                          AlertBox.open(AlertType.Info, 'Account nonce copied!')
                        }}>{ '0x' + event.nonce.toString(16) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                  </DataList.Root>
                </Card>
              )
            }
            case EventType.BridgeQueue: {
              return (
                <Card key={'OF4113' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="amber">Bridge queue</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Bridge hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.bridgeHash);
                          AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                        }}>{ Readability.toHash(event.bridgeHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Position:</DataList.Label>
                      <DataList.Value>
                        <Badge color={event.size.gt(1) ? 'yellow' : 'jade'}>{ event.size.gt(1) ? 'Executes after ' + Readability.toCount('transaction', event.size) : 'Executes immediately' }</Badge>
                      </DataList.Value>
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
                      <DataList.Label>Bridge hash:</DataList.Label>
                      <DataList.Value>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(event.bridgeHash);
                          AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                        }}>{ Readability.toHash(event.bridgeHash) }</Button>
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
            case EventType.BridgeAttester: {
              return (
                <Card key={'OF8' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge attester</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Chosen account:</DataList.Label>
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
                <Card key={'OF811' + event.type.toString() + index} mt="3">
                  <DataList.Root orientation={props.orientation}>
                    <DataList.Item>
                      <DataList.Label>Event:</DataList.Label>
                      <DataList.Value>
                        <Badge color="brown">Bridge participant</Badge>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Chosen account:</DataList.Label>
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
  const [expanded, setExpanded] = useState(props.open || false);
  if (!props.preview && receipt != null && (!AppData.tip || receipt.block_number.gt(AppData.tip)))
    AppData.tip = receipt.block_number;

  return (
    <Collapsible.Root open={expanded}>
      <Card variant="surface" mt="4" style={{ borderRadius: '22px', position: 'relative' }}>
        <Flex gap="3" align="start" className="card-expander" onClick={() => props.open ? undefined : setExpanded(!expanded)}>
          <Avatar size="3" mt="1" radius="full" fallback={Readability.toAssetFallback(transaction.asset)} src={Readability.toAssetImage(transaction.asset)} />
          <Box width="100%">
            <Flex justify="between" align="center" mb="1">
              <Text as="div" size="2" weight="bold">{ transaction.type == 'call' && transaction.function != null ? Readability.toFunctionName(transaction.function) : Readability.toTransactionType(transaction.type) }</Text>       
              <Badge size="1" variant="soft" color={props.preview ? 'yellow' : 'gray'}>
                <Icon path={mdiInformationOutline} size={0.65}></Icon>
                <Box px="1" ml="-1">
                  { !props.preview && receipt && <Text as="div" size="1" weight="light" color="gray">{ receipt.block_time ? new Date(receipt.block_time.toNumber()).toLocaleTimeString() : 'NULL' }</Text> }
                  { !props.preview && !receipt && <Spinner /> }
                  { props.preview && <Text as="div" size="1" weight="light" color="yellow">Preview!</Text> }
                </Box>
              </Badge>
            </Flex>
            {
              state != null &&
              <Flex gap="2" wrap="wrap">
                {
                  !transaction.error && EventResolver.isSummaryStateEmpty(state, ownerAddress) &&
                  <Badge size="1" color={receipt.successful ? 'jade' : 'red'}>{ receipt.successful ? (receipt.events.length > 0 ? Readability.toCount('event', receipt.events.length) : 'Successful') : 'Rollback' }<Icon path={receipt.successful ? mdiCheck : mdiAlert} size={0.55}></Icon></Badge>
                }
                {
                  transaction.error != null &&
                  <Badge size="1" color="red">Refund<Icon path={mdiAlert} size={0.55}></Icon></Badge>
                }
                {
                  state.errors.length > 0 &&
                  <Badge size="1" color="red">{ Readability.toCount('execution error', state.errors.length) }</Badge>
                }
                {
                  state.account.balances[ownerAddress] && Object.keys(state.account.balances[ownerAddress]).map((asset) => {
                    const value = state.account.balances[ownerAddress][asset];
                    const zero = value.supply.eq(0) && value.reserve.eq(0);
                    return (
                      <Flex key={'X0' + transaction.hash + asset} gap="2">
                        { (zero || !value.supply.eq(0)) && <Badge size="1" color={value.supply.gt(0) ? 'jade' : (value.supply.isNegative() ? 'red' : 'gray')}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge> }
                        {
                          !value.reserve.eq(0) &&
                          <Badge size="1" color="gold">
                            <Icon path={value.reserve.lt(0) ? mdiLockOpenVariantOutline : mdiLockOutline} size={0.55}></Icon> { Readability.toMoney(value.asset, value.reserve.lt(0) ? value.reserve.negated() : value.reserve) }
                          </Badge>
                        }
                      </Flex>
                    )
                  })
                }
                {
                  Object.keys(state.bridge.migrations).length > 0 &&
                  <Badge size="1" color="cyan">
                    { Readability.toValue(null, Object.keys(state.bridge.migrations).length, true, false) }<Icon path={mdiKeyChange} size={0.55}></Icon>
                  </Badge>
                }
                {
                  Object.keys(state.bridge.policies).length > 0 &&
                  <Badge size="1" color="blue">
                    { Readability.toValue(null, Object.keys(state.bridge.policies).length, true, false) }<Icon path={mdiBridge} size={0.55}></Icon>
                  </Badge>
                }
                {
                  Object.keys(state.bridge.transactions).length > 0 &&
                  <Badge size="1" color="blue">
                    { Readability.toValue(null, Object.keys(state.bridge.transactions).length, true, false) }<Icon path={mdiVectorLink} size={0.55}></Icon>
                  </Badge>
                }
                {
                  Object.keys(state.bridge.accounts).length > 0 &&
                  <Badge size="1" color="blue">
                    { Readability.toValue(null, Object.keys(state.bridge.accounts).length, true, false) }<Icon path={mdiVectorCurve} size={0.55}></Icon>
                  </Badge>
                }
                {
                  state.bridge.attesters.size > 0 &&
                  <Badge size="1" color="brown">
                    { Readability.toValue(null, state.bridge.attesters.size, false, false) }<Icon path={mdiStateMachine} size={0.55}></Icon>
                  </Badge>
                }
                {
                  state.bridge.participants.size > 0 &&
                  <Badge size="1" color="brown">
                    { Readability.toValue(null, state.bridge.participants.size, true, false) }<Icon path={mdiVectorSquareEdit} size={0.55}></Icon>
                  </Badge>
                }
                {
                  Object.keys(state.receipts).length > 0 &&
                  <Badge size="1" color="brown">
                    { Readability.toValue(null, Object.keys(state.receipts).length, true, false) }<Icon path={mdiReceiptTextCheck} size={0.55}></Icon>
                  </Badge>
                }
                {
                  Object.keys(state.bridge.queues).length > 0 && Object.keys(state.bridge.queues[Object.keys(state.bridge.queues)[0]]).map((asset) => {
                    const queue = state.bridge.queues[Object.keys(state.bridge.queues)[0]][asset];
                    return (
                      <Badge key={'X148' + transaction.hash + asset} size="1" color={queue.size.gt(1) ? 'yellow' : 'jade'}>
                        { Readability.toValue(null, queue.size, false, false) }<Icon path={mdiListBox} size={0.55}></Icon>
                      </Badge>
                    )
                  })
                }
                {
                  Object.keys(state.witness.accounts).map((asset) => {
                    const aliases = state.witness.accounts[asset].aliases;
                    const bridge = state.witness.accounts[asset].purpose == 'bridge';
                    return aliases.map((alias) => <Badge key={'X3' + alias} size="1" color={bridge ? 'blue' : 'jade'}>{ Readability.toAddress(alias, 6) }</Badge>)
                  })
                }
                {
                  Object.keys(state.witness.transactions).map((asset) => {
                    const event = state.witness.transactions[asset];
                    return event.stateHashes.map((stateHash) => <Badge key={'X4' + event.asset.toHex() + stateHash} size="1" color="gray">{ Readability.toAddress(stateHash, 4) }</Badge>)
                  })
                }
              </Flex>
            }
            {
              state == null &&
              <Flex gap="2" wrap="wrap" justify="between">
                <Badge size="1" color={props.preview ? 'orange' : 'gray'}>{ props.preview ? (typeof props.preview == 'string' ? props.preview : 'Preview transaction!') : 'Pending transaction' }</Badge>
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
              <DataList.Label>Gas price:</DataList.Label>
              <DataList.Value>{ transaction.gas_price != null ? Readability.toMoney(AssetId.fromHandle(transaction.asset.chain), transaction.gas_price) : <Badge color="yellow">Consensus override</Badge> }</DataList.Value>
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
                    <DataList.Value>{ Readability.toMoney(AssetId.fromHandle(transaction.asset.chain), receipt.relative_gas_use.multipliedBy(transaction.gas_price)) }</DataList.Value>
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
      </Card>
    </Collapsible.Root>
  )
}