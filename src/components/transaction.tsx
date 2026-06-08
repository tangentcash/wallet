import { Badge, Box, Button, Card, Code, DataList, Flex, Spinner, Text, Tooltip } from "@radix-ui/themes";
import { SummaryState, AssetId, Readability, EventType } from 'tangentsdk';
import { AlertBox, AlertType } from "./alert";
import { Link } from "react-router";
import { AppData } from "../core/app";
import { useMemo, useState } from "react";
import { mdiAlert, mdiCheck, mdiInformationOutline, mdiLockOpenVariantOutline, mdiLockOutline } from "@mdi/js";
import { AssetImage } from "./asset";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export function TransactionInputFields(props: { orientation: 'horizontal' | 'vertical', transaction: any }) {
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
              }}>{ Readability.toAddress(transaction.data) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Calldata:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                const data: any = JSON.stringify(transaction.args, null, 2);
                navigator.clipboard.writeText(data);
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toAddress(args) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    }
    case 'call': {
      const flags = Readability.toFunctionFlags(transaction.function);
      const origin = flags.pipelinePay ? transaction.function.substring(1) : transaction.function;
      const method = origin.match(/[\(\)]/) != null ? origin : ('address_of(@' + origin + ')');
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
              <Button size="2" variant="ghost" color="lime" onClick={() => {
                navigator.clipboard.writeText(origin);
                AlertBox.open(AlertType.Info, 'Program function copied!')
              }}>{ Readability.toAddress(method, 20) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Calldata:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toAddress(args, 20) }</Button>
            </DataList.Value>
          </DataList.Item>
          {
            Array.isArray(transaction.pays) && transaction.pays.map((item: any) =>
              <DataList.Item key={item.asset.id}>
                <DataList.Label>Value paid:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(item.asset, item.value) }</DataList.Value>
              </DataList.Item>)
          }
          <DataList.Item>
            <DataList.Label>Pay mode:</DataList.Label>
            <DataList.Value>
              <Tooltip content={flags.pipelinePay ? 'Value is paid in fully or partially from account balance delta' : 'Value is paid in full account balance directly'}>
                <Badge>{ flags.pipelinePay ? 'Pipeline pays' : 'Account pays' }</Badge>
              </Tooltip>
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
                <Flex align="center" gap="2" key={'IF1' + item.action.hash + index} mb={index == transaction.transactions.length - 1 ? '0' : '4'}>     
                  <AssetImage asset={item.action.asset} size="1"></AssetImage>
                  <Badge size="2" variant="soft">{ Readability.toTransactionType(item.action.type) }</Badge>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(item.action.hash);
                    AlertBox.open(AlertType.Info, 'Internal transaction hash copied!')
                  }}>{ Readability.toAddress(item.action.hash) }</Button>
                  <Link className="router-link" to={'/transaction/' + item.action.hash}>▒▒</Link>
                </Flex>
              )
            }
          </Card>
        </Box>
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
              }}>{ Readability.toAddress(transaction.bridge_hash) }</Button>
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
              }}>{ Readability.toAddress(transaction.route_hash) }</Button>
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
              }}>{ Readability.toAddress(transaction.group_public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Group signature:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.group_signature || 'NULL');
                AlertBox.open(AlertType.Info, 'Group signature copied!')
              }}>{ Readability.toAddress(transaction.group_signature) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'imbind':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.route_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toAddress(transaction.route_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.route_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Correction key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.correction_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Correction key copied!')
              }}>{ Readability.toAddress(transaction.correction_key) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Imperfect key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.imperfect_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Imperfect key copied!')
              }}>{ Readability.toAddress(transaction.imperfect_key) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Correction commitment:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.correction_commitment || 'NULL');
                AlertBox.open(AlertType.Info, 'Correction commitment copied!')
              }}>{ Readability.toAddress(transaction.correction_commitment) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Key commitment:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.key_commitment || 'NULL');
                AlertBox.open(AlertType.Info, 'Key commitment copied!')
              }}>{ Readability.toAddress(transaction.key_commitment) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
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
                  <Badge color={ typeof transaction.block_production == 'object' ? 'lime' : 'red' }>{ typeof transaction.block_production == 'object' ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.block_production) + ' locked' : 'Offline' }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.bridge_participation !== undefined &&
              <DataList.Item>
                <DataList.Label>Bridge participation:</DataList.Label>
                <DataList.Value>
                  <Badge color={ typeof transaction.bridge_participation == 'object' ? 'lime' : 'red' }>{ typeof transaction.bridge_participation == 'object' ? 'Online with ' + Readability.toMoney(new AssetId(), transaction.bridge_participation) + ' locked' : 'Offline' }</Badge>
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
                    <Badge color={ item.stake != null ? 'lime' : 'red' }>{ item.stake != null ? 'Online with ' + Readability.toMoney(new AssetId(), item.stake) : 'Offline' }</Badge>
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
                      }}>{ Readability.toAddress(item.broadcast_hash) }</Button>
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
    case 'rebind':
      return (
        <>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>Parent hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.setup_hash);
                  AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                }}>{ Readability.toAddress(transaction.setup_hash) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/transaction/' + transaction.setup_hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            transaction.proofs && transaction.proofs.map((item: any, index: number) =>
              <Card key={'IXF51' + item.correction_commitment + index} mt="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Renewal index:</DataList.Label>
                    <DataList.Value>{ Readability.toValue(null, index, false, false) }</DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Correction key:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.correction_key || 'NULL');
                        AlertBox.open(AlertType.Info, 'Correction key copied!')
                      }}>{ Readability.toAddress(item.correction_key) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Imperfect key:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.imperfect_key || 'NULL');
                        AlertBox.open(AlertType.Info, 'Imperfect key copied!')
                      }}>{ Readability.toAddress(item.imperfect_key) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Correction commitment:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.correction_commitment || 'NULL');
                        AlertBox.open(AlertType.Info, 'Correction commitment copied!')
                      }}>{ Readability.toAddress(item.correction_commitment) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Key commitment:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.key_commitment || 'NULL');
                        AlertBox.open(AlertType.Info, 'Key commitment copied!')
                      }}>{ Readability.toAddress(item.key_commitment) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
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
              }}>{ Readability.toAddress(transaction.bridge_hash) }</Button>
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
              }}>{ Readability.toAddress(transaction.withdraw_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.withdraw_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.hashdata && transaction.calldata && transaction.prepared &&
            <>
              <DataList.Item>
                <DataList.Label>Transaction id:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.hashdata);
                    AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                  }}>{ Readability.toAddress(transaction.hashdata) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Proof message:</DataList.Label>
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
              <DataList.Label>Relay message:</DataList.Label>
              <DataList.Value>
                <Code color="tomato" wrap="balance" size="1" variant="soft" style={{ whiteSpace: 'pre-wrap', maxWidth: '340px' }}>
                  <Box px="1" py="1">FAILED { transaction.error }</Box>
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
              }}>{ Readability.toAddress(transaction.broadcast_hash) }</Button>
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
                <DataList.Label>Block id:</DataList.Label>
                <DataList.Value>{ transaction.proof.block_id?.toString() || 'NULL' }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Transaction id:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.proof.transaction_id);
                    AlertBox.open(AlertType.Info, 'Transaction id copied!')
                  }}>{ Readability.toAddress(transaction.proof.transaction_id) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Proof strength:</DataList.Label>
                <DataList.Value>
                  <Badge color="lime" mr="1">{ Readability.toCount('commitment', commitments) }</Badge>
                  <Badge color="lime">{ Readability.toCount('signature', signatures) }</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Relay status:</DataList.Label>
                <DataList.Value>
                  <Badge color={transaction.proof.success ? 'lime' : 'red'}>{ transaction.proof.success ? 'Executed' : 'Reverted' }</Badge>
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
                <Badge color="lime">{ Readability.toCount('signature', signatures) } in { Readability.toCount('commitment', commitments) }</Badge>
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
export function TransactionOutputFields(props: { orientation: 'horizontal' | 'vertical', state: SummaryState }) {
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
                        }}>{ Readability.toAddress(event.bridgeHash) }</Button>
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
                        }}>{ Readability.toAddress(event.bridgeHash) }</Button>
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
                        }}>{ Readability.toAddress(event.bridgeHash) }</Button>
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
                        }}>{ Readability.toAddress(event.bridgeHash) }</Button>
                      </DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                      <DataList.Label>Position:</DataList.Label>
                      <DataList.Value>
                        <Badge color={event.size.gt(1) ? 'yellow' : 'lime'}>{ event.size.gt(1) ? 'Executes after ' + Readability.toCount('transaction', event.size) : 'Executes immediately' }</Badge>
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
                        }}>{ Readability.toAddress(event.bridgeHash) }</Button>
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
                        <Badge color="lime">{ event.purpose[0].toUpperCase() + event.purpose.substring(1) } account</Badge>
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
                        }}>{ Readability.toAddress(event.stateHash) }</Button>
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
                        }}>{ Readability.toAddress(event.transactionHash) }</Button>
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
export function TransactionDetailsView(props: { orientation: 'horizontal' | 'vertical', transaction: any, receipt?: any, state?: SummaryState, preview?: string | boolean }) {
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const orientation = props.orientation;
  return (
    <Box>
      <DataList.Root orientation={orientation}>
        <DataList.Item>
          <DataList.Label>Transaction hash:</DataList.Label>
          <DataList.Value>
            <Button size="2" variant="ghost" color="indigo" onClick={() => {
              navigator.clipboard.writeText(transaction.hash);
              AlertBox.open(AlertType.Info, 'Transaction hash copied!')
            }}>{ Readability.toAddress(transaction.hash, 12) }</Button>
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
            }}>{ Readability.toAddress(transaction.signature, 12) }</Button>
          </DataList.Value>
        </DataList.Item>
        {
          !props.preview && receipt &&
          <>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                <Badge color={receipt.successful ? 'lime' : 'red'}>Execution { receipt.successful ? 'finalized' : 'reverted' }</Badge>
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
                  <Badge color={AppData.tip.minus(receipt.block_number).gt(0) ? 'lime' : 'yellow'}>{ Readability.toCount('confirmation', AppData.tip.minus(receipt.block_number).plus(1)) }</Badge>
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
              <Badge color="yellow">Not included in a block</Badge>
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
      <TransactionInputFields orientation={orientation} transaction={transaction}></TransactionInputFields>
      {
        state != null && state.events.length > 0 &&
        <>
          <Box mt="4" mb="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <TransactionOutputFields orientation={orientation} state={state}></TransactionOutputFields>
        </>
      }
    </Box>
  );
}
export function TransactionView(props: { ownerAddress: string, transaction: any, receipt?: any, state?: SummaryState, open?: boolean, preview?: string | boolean, summary?: boolean }) {
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const ownerAddress = props.ownerAddress;
  const finalized = !receipt || receipt.successful;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [expanded, setExpanded] = useState(props.open || false);
  const summary = useMemo((): {
    delta: { asset: AssetId, supply: BigNumber, reserve: BigNumber }[],
    volume: { asset: AssetId, value: BigNumber }[],
    empty: boolean
  } | null => {
    if (!state || !finalized)
      return null;

    const volumes: Record<string, { asset: AssetId, value: BigNumber }> = { };
    for (let account of Object.keys(state.account.balances)) {
      const balances = state.account.balances[account];
      for (let asset of Object.keys(balances)) {
        const target = balances[asset], total = volumes[asset];
        const volume = BigNumber.max(target.supply.minus(target.reserve), 0);
        volumes[asset] = { asset: target.asset, value: total ? total.value.plus(volume) : volume }; 
      }
    }

    const baseBalance = state.account.balances[ownerAddress];
    return {
      delta: baseBalance ? Object.keys(baseBalance).map((asset) => {
        const target = baseBalance[asset];
        return {
          asset: target.asset,
          supply: target.supply,
          reserve: target.reserve.lt(0) && target.supply.lt(0) ? target.reserve.minus(target.supply) : target.reserve
        };
      }).filter(x => !x.supply.eq(0) || !x.reserve.eq(0)) : [],
      volume: Object.keys(volumes).map((id) => volumes[id]).filter((v) => v.value.gt(0)),
      empty: !finalized || !Object.keys(baseBalance || { }).length
    };
  }, [state, finalized, ownerAddress]);
  if (!props.preview && receipt != null && (!AppData.tip || receipt.block_number.gt(AppData.tip)))
    AppData.tip = receipt.block_number;
  
  return (
    <Collapsible.Root open={expanded}>
      <Card variant="surface" style={{ borderRadius: '22px', position: 'relative' }}>
        <Flex gap="3" align="start" className="card-expander" onClick={() => props.open ? undefined : setExpanded(!expanded)}>
          <AssetImage asset={transaction.asset}></AssetImage>
          <Box width="100%">
            <Flex justify="between" align="center" mb="1">
              <Text as="div" size="2" weight="bold">{ transaction.transactions?.length > 0 ? transaction.transactions?.length + 'x' : ''} { transaction.type == 'call' && transaction.function != null ? Readability.toFunctionName(transaction.function) : Readability.toTransactionType(transaction.type) }</Text>       
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
              state &&
              <Flex gap="2" wrap="wrap">
                {
                  props.summary &&
                  <Badge size="1" color="lime">{ Readability.toAddress(transaction.hash, 6) }</Badge>
                }
                {
                  !transaction.error && (!summary || summary.empty) &&
                  <Badge size="1" color={receipt.successful ? 'lime' : 'red'}>{ receipt.successful ? (receipt.events.length > 0 ? Readability.toCount('event', receipt.events.length) : 'Successful') : 'Reverted' }<Icon path={receipt.successful ? mdiCheck : mdiAlert} size={0.55}></Icon></Badge>
                }
                {
                  (transaction.error != null || (transaction.proof && !transaction.proof.success)) &&
                  <Badge size="1" color="red">Reverted<Icon path={mdiAlert} size={0.55}></Icon></Badge>
                }
                {
                  summary && summary.delta.map((item) => 
                    <Flex key={'X0' + transaction.hash + item.asset.id} gap="2">
                      { (!item.supply.eq(0)) && <Badge size="1" color={item.supply.gt(0) ? 'lime' : (item.supply.isNegative() ? 'red' : 'gray')}>{ Readability.toMoney(item.asset, item.supply, true) }</Badge> }
                      {
                        !item.reserve.eq(0) &&
                        <Badge size="1" color={item.reserve.lt(0) ? 'gold' : (item.reserve.isPositive() ? 'amber' : 'gray')}>
                          <Icon path={item.reserve.lt(0) ? mdiLockOpenVariantOutline : mdiLockOutline} size={0.55}></Icon> { Readability.toMoney(item.asset, item.reserve.negated(), true) }
                        </Badge>
                      }
                    </Flex>
                  )
                }
                {
                  props.summary && summary && summary.volume.map((item) => 
                    <Flex key={'XXX0' + transaction.hash + item.asset.id } gap="2">
                      { <Badge size="1" color="gold">{ Readability.toMoney(item.asset, item.value) }</Badge> }
                    </Flex>
                  )
                }
              </Flex>
            }
            {
              state == null &&
              <Flex gap="2" wrap="wrap" justify="between">
                <Badge size="1" color={props.preview ? 'yellow' : 'gray'}>{ props.preview ? (typeof props.preview == 'string' ? props.preview : 'Preview transaction!') : 'Pending transaction' }</Badge>
              </Flex>
            }
          </Box>
        </Flex>
        <Collapsible.Content>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <TransactionDetailsView orientation={orientation} transaction={transaction} receipt={receipt} state={props.state} preview={props.preview}></TransactionDetailsView>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  )
}