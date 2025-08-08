import { Avatar, Badge, Box, Button, Card, Code, DataList, DropdownMenu, Flex, Spinner, Text } from "@radix-ui/themes";
import { Readability } from "../core/text";
import { RPC, EventResolver, SummaryState, Types, AssetId } from 'tangentsdk';
import { AlertBox, AlertType } from "./alert";
import { Link } from "react-router";
import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";
import { AppData } from "../core/app";

function InputFields(props: { orientation: 'horizontal' | 'vertical', transaction: any }) {
  const transaction = props.transaction;
  switch (transaction.type) {
    case 'transfer':
      return transaction.to.map((item: any, index: number) =>
        <Card key={item.to + index} mb={index == transaction.to.length - 1 ? '0' : '4'}>
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
    case 'refuel':
      return transaction.to.map((item: any, index: number) =>
        <Card key={item.to + index} mb={index == transaction.to.length - 1 ? '0' : '4'}>
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
              <DataList.Label>Gas paid:</DataList.Label>
              <DataList.Value>{ Readability.toGas(item.value) }</DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Card>
      )
    case 'upgrade': {
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Program type:</DataList.Label>
            <DataList.Value>
              <Badge color="red">{ transaction.from[0].toUpperCase() + transaction.from.substring(1) }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Program data:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.data);
                AlertBox.open(AlertType.Info, 'Program calldata copied!')
              }}>{ Readability.toHash(transaction.data) }</Button>
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
        </DataList.Root>
      )
    }
    case 'call': {
      const args = JSON.stringify(transaction.args);
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Program account:</DataList.Label>
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
            <DataList.Label>Program function:</DataList.Label>
            <DataList.Value>
              <Badge>{ transaction.function.match(/[\(\)]/) != null ? transaction.function : ('address_of(@' + transaction.function + ')') }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Program arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>{ Readability.toHash(args) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Value paid:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.value) }</DataList.Value>
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
            <DataList.Label>Block production:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.block_production == 1 ? 'jade' : (transaction.block_production == -1 ? 'gray' : 'red') }>{ transaction.block_production == 1 ? 'Online' : (transaction.block_production == -1 ? 'Standby' : 'Offline') }</Badge>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.participation_stakes.map((item: any) => 
              <DataList.Item key={item.asset.chain}>
                <DataList.Label>{ item.asset.chain } participation stake:</DataList.Label>
                <DataList.Value>
                  <Badge color={ item.stake != null && item.stake >= 0.0 ? 'jade' : 'red' }>{ item.stake != null ? (item.stake >= 0.0 ? 'Lock ' : 'Unlock ') + Readability.toMoney(item.asset, item.stake) : 'Unlock all' }</Badge>
                </DataList.Value>
              </DataList.Item>
            )
          }
          {
            transaction.attestation_stakes.map((item: any) => 
              <DataList.Item key={item.asset.chain}>
                <DataList.Label>{ item.asset.chain } attestation stake:</DataList.Label>
                <DataList.Value>
                  <Badge color={ item.stake != null && item.stake >= 0.0 ? 'jade' : 'red' }>{ item.stake != null ? (item.stake >= 0.0 ? 'Lock ' : 'Unlock ') + Readability.toMoney(item.asset, item.stake) : 'Unlock all' }</Badge>
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
            <DataList.Label>Public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.public_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Public key copied!')
              }}>{ Readability.toHash(transaction.public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_withdrawal':
      return (
        <>
          <DataList.Root orientation={props.orientation} mb="4">
            {
              transaction.from_manager &&
              <DataList.Item>
                <DataList.Label>From manager account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.from_manager || 'NULL');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(transaction.from_manager) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + transaction.from_manager}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
            }
            {
              transaction.to_manager &&
              <DataList.Item>
                <DataList.Label>To manager account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transaction.to_manager || 'NULL');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(transaction.to_manager) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + transaction.to_manager}>▒▒</Link>
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
      let attestations = 0;
      const executionBlockId = new BigNumber(Array.isArray(transaction.assertion.block_id) ? transaction.assertion.block_id[0] || 0 : 0);
      const finalizationBlockId = new BigNumber(Array.isArray(transaction.assertion.block_id) ? transaction.assertion.block_id[1] || 0 : 0);
      const finalized = executionBlockId.gt(0) && finalizationBlockId.gt(0) && executionBlockId.lte(finalizationBlockId);
      console.log(executionBlockId.toString(), finalizationBlockId.toString());
      Object.keys(transaction.output_hashes).forEach((item) => attestations += transaction.output_hashes[item].length);
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
              <DataList.Value>{ executionBlockId.gt(0) ? executionBlockId.toString() || 'NULL' : 'NULL' }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                { finalized && <Badge color="jade">Attestation finalized in { Readability.toCount('block', finalizationBlockId.minus(executionBlockId)) }</Badge> }
                { !finalized && <Badge color="yellow">Pending finalization</Badge> }
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Attestations:</DataList.Label>
              <DataList.Value>{ Readability.toCount('attestation', attestations) }</DataList.Value>
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
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.incoming_fee) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Withdrawal fee:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.outgoing_fee) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Security level:</DataList.Label>
            <DataList.Value>Requires { Readability.toCount('participant', transaction.security_level) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Account requests:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.accepts_account_requests ? 'jade' : 'red' }>{ transaction.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Withdrawal requests:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.accepts_withdrawal_requests ? 'jade' : 'red' }>{ transaction.accepts_account_requests ? 'Accepting' : 'Rejecting' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_regrouping':
      return (
          transaction.participants.map((item: any, index: number) =>
            <Card key={item.manager + index} mb="4">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Manager account:</DataList.Label>
                  <DataList.Value>
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(item.manager);
                      AlertBox.open(AlertType.Info, 'Address copied!')
                    }}>{ Readability.toAddress(item.manager) }</Button>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Owner account:</DataList.Label>
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
    case 'depository_regrouping_preparation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_regrouping_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_regrouping_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_regrouping_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Cipher public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.cipher_public_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Cipher public key copied!')
              }}>{ Readability.toHash(transaction.cipher_public_key) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'depository_regrouping_commitment':
      return (
        <>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>Parent hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.depository_regrouping_preparation_hash);
                  AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                }}>{ Readability.toHash(transaction.depository_regrouping_preparation_hash) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/transaction/' + transaction.depository_regrouping_preparation_hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            transaction.encrypted_shares.map((item: any, index: number) =>
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
                    <DataList.Label>Encrypted seed:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.encrypted_seed);
                        AlertBox.open(AlertType.Info, 'Encrypted seed copied!')
                      }}>{ Readability.toHash(item.encrypted_seed) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    case 'depository_regrouping_finalization':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.depository_regrouping_commitment_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.depository_regrouping_commitment_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.depository_regrouping_commitment_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color={transaction.successful ? 'jade' : 'red'}>{ transaction.successful ? 'Migration successful' : 'Migration error' }</Badge>
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
      case Types.AccountProgram:
      case Types.DepositoryBalance:
      case Types.DepositoryPolicy:
      case Types.WitnessAccount:
      case Types.WitnessTransaction:
      case Types.Rollup:
      case Types.DepositoryAccount:
      case Types.DepositoryRegrouping:
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
            const [_, event] = data;
            return (
              <Card key={'Y0' + address + event.asset.handle} mt="3">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>Event:</DataList.Label>
                    <DataList.Value>
                      <Badge color="cyan">Transfer</Badge>
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
        Array.from(state.account.programs.keys()).map((address) => {
          return (
            <Card key={'Y11' + address} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="cyan">Account upgrade</Badge>
                  </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                  <DataList.Label>Program account:</DataList.Label>
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
                      <Badge color="lime">Depository transfer</Badge>
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
                      <Badge color="jade">Depository account</Badge>
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
                    <DataList.Value>{ Readability.toCount('account', event.newAccounts, true) }</DataList.Value>
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
                      <Badge color="yellow">Depository queue</Badge>
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
                      <Badge color="jade">Depository policy</Badge>
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
                      <Badge color={ event.acceptsAccountRequests ? 'jade' : 'red' }>{ event.acceptsAccountRequests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Withdrawal requests:</DataList.Label>
                    <DataList.Value>
                      <Badge color={ event.acceptsWithdrawalRequests ? 'jade' : 'red' }>{ event.acceptsWithdrawalRequests ? 'Accepting' : 'Rejecting' }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          })
        })
      }
      {
        Object.entries([...state.depository.participants]).map((inputs) => {
          const address = inputs[1];
          return (
            <Card key={'Y5' + address} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="jade">Depository participant</Badge>
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
          const event = inputs[1];
          return (
            <Card key={'Y6' + event.aliases[0] + event.asset.handle} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge color="jade">Witness account</Badge>
                  </DataList.Value>
                </DataList.Item>
                {
                  event.aliases.map((item, index) =>
                    <DataList.Item key={event.aliases[0] + event.asset.handle + item}>
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
                    <Badge color="gold">Witness transaction</Badge>
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
                  <DataList.Value>{ message?.toString() || 'NULL' }</DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>
          )
        })
      }
      {
        events.map((event, index) => {
          return (
            <Card key={'Y10' + event.event.toString() + index} mt="3">
              <DataList.Root orientation={props.orientation}>
                <DataList.Item>
                  <DataList.Label>Event:</DataList.Label>
                  <DataList.Value>
                    <Badge>0x{ event.event.toString(16) }</Badge>
                  </DataList.Value>
                </DataList.Item>
                {
                  event.args.length > 0 &&
                  <DataList.Item key={index}>
                    <DataList.Label>Data:</DataList.Label>
                    <DataList.Value>
                      <Code color="tomato" wrap="balance" size="1" variant="soft" style={{ whiteSpace: 'pre-wrap' }}>
                        <Box px="1" py="1">{ JSON.stringify(event.args.length > 1 ? event.args : event.args[0], null, 2) }</Box>
                      </Code>
                    </DataList.Value>
                  </DataList.Item>
                }
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
  if (receipt != null && receipt.block_number.gt(AppData.tip))
    AppData.tip = receipt.block_number;

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
                        { !value.supply.eq(0) && <Badge size="1" radius="medium" color={value.supply.gt(0) ? 'jade' : (value.supply.isNegative() ? 'red' : 'gray')} style={{ textTransform: 'uppercase' }}>{ Readability.toMoney(value.asset, value.supply, true) }</Badge> }
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
                    return aliases.map((alias) => <Badge key={'X3' + alias} size="1" radius="medium" color="jade">+{ Readability.toAddress(alias) }</Badge>)
                  })
                }
                {
                  Object.keys(state.witness.transactions).map((asset) => {
                    const event = state.witness.transactions[asset];
                    return event.transactionIds.map((tx) => <Badge key={'X4' + event.asset.toHex() + tx} size="1" radius="medium" color="gold">@{ Readability.toAddress(tx) }</Badge>)
                  })
                }
                {
                  state.account.programs.size > 0 && Array.from(state.account.programs).map((address) =>
                    <Badge key={'X5' + address} size="1" radius="medium" color="jade">+{ Readability.toAddress(address) }</Badge>)
                }
                {
                  Object.keys(state.receipts).length > 0 &&
                  <Badge size="1" radius="medium" color="gold">{ Readability.toCount('receipt', Object.keys(state.receipts).length) }</Badge>
                }
                {
                  Object.keys(state.depository.accounts).length > 0 && !Object.keys(state.witness.accounts).length &&
                  <Badge size="1" radius="medium" color="jade">{ Readability.toCount('account', Object.keys(state.depository.accounts).length, true) }</Badge>
                }
                {
                  Object.keys(state.depository.policies).length > 0 &&
                  <Badge size="1" radius="medium" color="jade">{ Readability.toCount('change', Object.keys(state.depository.policies).length) }</Badge>
                }
                {
                  state.depository.participants.size > 0 &&
                  <Badge size="1" radius="medium" color="jade">{ Readability.toCount('participant', state.depository.participants.size) }</Badge>
                }
                {
                  EventResolver.isSummaryStateEmpty(state, ownerAddress) &&
                  <Badge size="1" radius="medium" color={receipt.successful ? 'bronze' : 'red'}>{ receipt.successful ? 'Successful' + (receipt.events.length > 0 ? ': ' + Readability.toCount('event', receipt.events.length) + ' generated' : ' without events') : 'Execution error' }</Badge>
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
                    <Badge color={receipt.successful ? 'jade' : 'red'}>Execution { receipt.successful ? 'finalized' : 'reverted' } in { Readability.toTimespan(time) }</Badge>
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
                          const consensusData = await RPC.getMempoolCumulativeConsensus(transaction.hash);
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
                      <DataList.Value>{ Readability.toCount('attester', consensus.committee) }</DataList.Value>
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
            state != null && (!EventResolver.isSummaryStateEmpty(state) || (receipt && receipt.events.length > 0)) &&
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