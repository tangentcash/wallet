import { Avatar, Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Spinner, Text } from "@radix-ui/themes";
import { Readability } from "../core/text";
import { Interface, Netstat, SummaryState } from "../core/wallet";
import { AlertBox, AlertType } from "./alert";
import { AssetId, Pubkeyhash, Signing } from "../core/tangent/algorithm";
import { TextUtil } from "../core/tangent/text";
import { Link } from "react-router";
import { useState } from "react";
import { Types } from "../core/tangent/types";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";

function parameterToString(event: any): string {
  if (typeof event == 'object' || Array.isArray(event)) {
    try {
      return JSON.stringify(event, null, 1);
    } catch {
      return '[JSON]';
    }
  } else if (typeof event == 'string') {
    if (event.length == 42 && TextUtil.isHexEncoding(event))
      return Signing.encodeAddress(new Pubkeyhash(event)) || event;

    return event;
  } else if (event instanceof BigNumber) {
    return event.toString();
  } else if (typeof event == 'boolean') {
    return event ? 'true' : 'false';
  } else if (typeof event == 'number' || typeof event == 'bigint') {
    return event.toString();
  }
  return '[BLOB]';
}
function ContractFields(props: { orientation: 'horizontal' | 'vertical', transaction: any }) {
  const transaction = props.transaction;
  switch (transaction.type) {
    case 'transfer':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>To account:</DataList.Label>
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
            <DataList.Label>Value paid:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.value) }</DataList.Value>
          </DataList.Item>
          {
            transaction.memo != null &&
            <DataList.Item>
              <DataList.Label>Memo:</DataList.Label>
              <DataList.Value>{ transaction.memo }</DataList.Value>
            </DataList.Item>
          }
        </DataList.Root>
      )
    case 'omnitransfer':
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
    case 'deployment':
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
            <DataList.Label>Program arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                const data: any = JSON.stringify(transaction.args, null, 2);
                navigator.clipboard.writeText(data);
                AlertBox.open(AlertType.Info, 'Program arguments copied!')
              }}>JSON array data</Button>
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
            <DataList.Label>Patchable:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.patchable ? 'red' : 'green' }>{ transaction.patchable ? 'Yes' : 'No' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Segregated:</DataList.Label>
            <DataList.Value>
              <Badge color={ transaction.segregated ? 'green' : 'red' }>{ transaction.segregated ? 'Yes' : 'No' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'invocation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Invocation account:</DataList.Label>
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
            <DataList.Label>Invocation arguments:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
                AlertBox.open(AlertType.Info, 'Invocation arguments copied!')
              }}>JSON array data</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Function:</DataList.Label>
            <DataList.Value>
              <Badge>{ transaction.function } | { transaction.hashcode.toString() }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'withdrawal':
      return transaction.to.map((item: any, index: number) =>
        <Card key={item.to + index} mb={index == transaction.to.length - 1 ? '0' : '4'}>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>From account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(transaction.proposer.address);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(transaction.proposer) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + transaction.proposer}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
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
                  <Box ml="2">
                    <Link className="router-link" to={'/transaction/' + item.hash}>▒▒</Link>
                  </Box>
                </Flex>
              )
            }
          </Card>
        </Box>
      )
    case 'commitment':
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
    case 'incoming_claim':
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
            <DataList.Item>
              <DataList.Label>Fee paid:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(transaction.assertion.asset, transaction.assertion.fee) }</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            transaction.assertion.from.map((item: any, index: number) =>
              <Card key={item.address + index} mb="4">
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>From address:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.address) } — { Readability.toAddressIndex(item.address_index) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Value paid:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(transaction.asset, item.value) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
          {
            transaction.assertion.to.map((item: any, index: number) =>
              <Card key={item.address + index} mb={index == transaction.assertion.to.length - 1 ? '0' : '4'}>
                <DataList.Root orientation={props.orientation}>
                  <DataList.Item>
                    <DataList.Label>To address:</DataList.Label>
                    <DataList.Value>
                      <Button size="2" variant="ghost" color="indigo" onClick={() => {
                        navigator.clipboard.writeText(item.address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(item.address) } — { Readability.toAddressIndex(item.address_index) }</Button>
                    </DataList.Value>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.Label>Value received:</DataList.Label>
                    <DataList.Value>{ Readability.toMoney(transaction.asset, item.value) }</DataList.Value>
                  </DataList.Item>
                </DataList.Root>
              </Card>
            )
          }
        </>
      )
    case 'outgoing_claim':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Initiator transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.transaction_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.transaction_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.transaction_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Replay transaction id:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.transaction_id);
                AlertBox.open(AlertType.Info, 'Transaction id copied!')
              }}>{ Readability.toHash(transaction.transaction_id) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Replay transaction data:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.transaction_data);
                AlertBox.open(AlertType.Info, 'Transaction data copied!')
              }}>{ Readability.toHash(transaction.transaction_data) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Replay transaction message:</DataList.Label>
            <DataList.Value>{ transaction.transaction_message || 'none' }</DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'address_account':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Router address:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.address);
                AlertBox.open(AlertType.Info, 'Router address copied!')
              }}>{ Readability.toAddress(transaction.address) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'pubkey_account':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Router pubkey:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.pubkey);
                AlertBox.open(AlertType.Info, 'Router pubkey copied!')
              }}>{ Readability.toHash(transaction.pubkey) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Router sighash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.sighash);
                AlertBox.open(AlertType.Info, 'Router sighash copied!')
              }}>{ Readability.toHash(transaction.sighash) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'delegation_account':
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
    case 'custodian_account':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Initiator transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" disabled={!transaction.delegation_account_hash} onClick={() => {
                navigator.clipboard.writeText(transaction.delegation_account_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.delegation_account_hash) }</Button>
              {
                transaction.delegation_account_hash &&
                <Box ml="2">
                  <Link className="router-link" to={'/transaction/' + transaction.delegation_account_hash}>▒▒</Link>
                </Box>
              }
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Owner account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" disabled={!transaction.owner} onClick={() => {
                navigator.clipboard.writeText(transaction.owner || 'none');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.owner) }</Button>
              {
                transaction.owner &&
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + transaction.owner}>▒▒</Link>
                </Box>
              }
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Custodian pubkey:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.pubkey);
                AlertBox.open(AlertType.Info, 'Custodian pubkey copied!')
              }}>{ Readability.toHash(transaction.pubkey) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Custodian sighash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.sighash);
                AlertBox.open(AlertType.Info, 'Custodian sighash copied!')
              }}>{ Readability.toHash(transaction.sighash) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Custodian index:</DataList.Label>
            <DataList.Value>
              <Badge color="red" size="2" radius="medium">0x{ transaction.pubkey_index.toString(16) }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'contribution_allocation':
      return (
        <Text size="1" color="gray">No additional contract fields</Text>
      )
    case 'contribution_selection':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.contribution_allocation_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.contribution_allocation_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.contribution_allocation_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Proposer:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.proposer);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.proposer) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>1st public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.public_key_1);
                AlertBox.open(AlertType.Info, 'Key copied!')
              }}>{ Readability.toHash(transaction.public_key_1) }</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'contribution_activation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.contribution_selection_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.contribution_selection_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.contribution_selection_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Proposer:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.proposer);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.proposer) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>2nd public key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.public_key_2);
                AlertBox.open(AlertType.Info, 'Key copied!')
              }}>{ Readability.toHash(transaction.public_key_2) }</Button>
            </DataList.Value>
          </DataList.Item>
          {
            transaction.verifying_wallet &&
            <>
              {
                transaction.verifying_wallet.addresses.map((item: any, index: number) =>
                  <DataList.Item key={item} style={{ marginTop: index == 0 ? '6px' : '0' }}>
                    <DataList.Label>Contribution address v{transaction.verifying_wallet.addresses.length - index}:</DataList.Label>
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
                <DataList.Label>Contribution address index:</DataList.Label>
                <DataList.Value>{ Readability.toAddressIndex(transaction.verifying_wallet.address_index) }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Contribution verifying key:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" disabled={!transaction.verifying_wallet.verifying_key} onClick={() => {
                    navigator.clipboard.writeText(transaction.verifying_wallet.verifying_key || 'none');
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toHash(transaction.verifying_wallet.verifying_key) }</Button>
                </DataList.Value>
              </DataList.Item>
            </>
          }
        </DataList.Root>
      )
    case 'contribution_deallocation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.contribution_activation_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.contribution_activation_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.contribution_activation_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'contribution_deselection':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.contribution_deallocation_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.contribution_deallocation_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.contribution_deallocation_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>1st private key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.encrypted_secret_key_1);
                AlertBox.open(AlertType.Info, 'Key copied!')
              }}>{ Readability.toHash(transaction.encrypted_secret_key_1) } (encrypted)</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    case 'contribution_deactivation':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Parent transaction hash:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.contribution_deselection_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ Readability.toHash(transaction.contribution_deselection_hash) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/transaction/' + transaction.contribution_deselection_hash}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>2nd private key:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.encrypted_secret_key_2);
                AlertBox.open(AlertType.Info, 'Key copied!')
              }}>{ Readability.toHash(transaction.encrypted_secret_key_2) } (encrypted)</Button>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
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
        </DataList.Root>
      )
    case 'depository_migration':
      return (
        <DataList.Root orientation={props.orientation}>
          <DataList.Item>
            <DataList.Label>Proposer account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(transaction.proposer);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(transaction.proposer) }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/account/' + transaction.proposer}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Value:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(transaction.asset, transaction.value) }</DataList.Value>
          </DataList.Item>
        </DataList.Root>
      )
    default:
      return <Text size="1" color="gray">No additional contract fields</Text>
  }
}
function EventField(props: { orientation: 'horizontal' | 'vertical', event: any }) {
  const data: { event: BigNumber, args: any[] } = props.event;
  switch (data.event.toNumber()) {
    case 0: {
      return (
        <Card>
          <DataList.Root orientation={props.orientation}>
            <DataList.Item>
              <DataList.Label>Event:</DataList.Label>
              <DataList.Value>
                <Badge color="red">Execution error</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Message:</DataList.Label>
              <DataList.Value>{ data.args[0]?.toString() || 'none' }</DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Card>
      )
    }
    case Types.AccountBalance: {
      if (data.args.length >= 4 && (data.args[0] instanceof BigNumber || typeof data.args[0] == 'string') && typeof data.args[1] == 'string' && typeof data.args[2] == 'string' && data.args[3] instanceof BigNumber) {
        const [assetId, from, to, value] = data.args;
        const fromAddress = Signing.encodeAddress(new Pubkeyhash(from)) || from;
        const toAddress = Signing.encodeAddress(new Pubkeyhash(to)) || to;
        const asset = new AssetId(assetId);
        if (!asset.handle)
          break;
        
        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="blue">Account payment</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>From account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(fromAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(fromAddress) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + fromAddress}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>To account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(toAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(toAddress) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + toAddress}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Value:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(asset, value) }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      } else if (data.args.length >= 4 && (data.args[0] instanceof BigNumber || typeof data.args[0] == 'string') && typeof data.args[1] == 'string' && data.args[2] instanceof BigNumber && data.args[3] instanceof BigNumber) {
        const [assetId, owner, supply, reserve] = data.args;
        const ownerAddress = Signing.encodeAddress(new Pubkeyhash(owner)) || owner;
        const asset = new AssetId(assetId);
        if (!asset.handle)
          break;

        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="blue">Account balance</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Owner account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(ownerAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(ownerAddress) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + ownerAddress}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Supply:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(asset, supply, true) }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Reserve:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(asset, reserve, true) }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    case Types.AccountDepository: {
      if (data.args.length >= 4 && (data.args[0] instanceof BigNumber || typeof data.args[0] == 'string') && typeof data.args[1] == 'string' && data.args[2] instanceof BigNumber && data.args[3] instanceof BigNumber) {
        const [assetId, owner, custody, coverage] = data.args;
        const ownerAddress = Signing.encodeAddress(new Pubkeyhash(owner)) || owner;
        const asset = new AssetId(assetId);
        if (!asset.handle)
          break;
        
        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="green">Account contribution</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Owner account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(ownerAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(ownerAddress) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + ownerAddress}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Custody:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(asset, custody, true) }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Coverage:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(asset, coverage, true) }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    case Types.WitnessAddress: {
      if (data.args.length >= 2 && (data.args[0] instanceof BigNumber || typeof data.args[0] == 'string') && data.args[1] instanceof BigNumber) {
        const [assetId, addressIndex, addressAliases] = [data.args[0], data.args[1], data.args.slice(2)];
        const asset = new AssetId(assetId);
        if (!asset.handle)
          break;

        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="yellow">Witness address</Badge>
                </DataList.Value>
              </DataList.Item>
              {
                addressAliases.map((item, index) =>
                  <DataList.Item key={item}>
                    <DataList.Label>Address v{addressAliases.length - index}:</DataList.Label>
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
                <DataList.Label>Address index:</DataList.Label>
                <DataList.Value>{ Readability.toAddressIndex(addressIndex) } — { asset.chain }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    case Types.WitnessTransaction: {
      if (data.args.length == 2 && (data.args[0] instanceof BigNumber || typeof data.args[0] == 'string') && typeof data.args[1] == 'string') {
        const [assetId, transactionId] = data.args;
        const asset = new AssetId(assetId);
        if (!asset.handle)
          break;

        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="yellow">Witness transaction</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Transaction id:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(transactionId);
                    AlertBox.open(AlertType.Info, 'Transaction id copied!')
                  }}>{ Readability.toHash(transactionId) }</Button>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Transaction type:</DataList.Label>
                <DataList.Value>{ asset.chain }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    case Types.Rollup: {
      if (data.args.length == 3 && typeof data.args[0] == 'string' && data.args[1] instanceof BigNumber && data.args[2] instanceof BigNumber) {
        const [transactionHash, relativeGasUse, relativeGasPaid] = data.args;
        return (
          <Card>
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
                <DataList.Value>{ Readability.toGas(relativeGasUse) }</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Relative gas paid:</DataList.Label>
                <DataList.Value>{ Readability.toGas(relativeGasPaid) }</DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    case Types.ContributionAllocation: {
      if (data.args.length == 1 && typeof data.args[0] == 'string') {
        const [owner] = data.args;
        const ownerAddress = Signing.encodeAddress(new Pubkeyhash(owner)) || owner;
        return (
          <Card>
            <DataList.Root orientation={props.orientation}>
              <DataList.Item>
                <DataList.Label>Event:</DataList.Label>
                <DataList.Value>
                  <Badge color="green">Contribution allocation</Badge>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Owner account:</DataList.Label>
                <DataList.Value>
                  <Button size="2" variant="ghost" color="indigo" onClick={() => {
                    navigator.clipboard.writeText(ownerAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}>{ Readability.toAddress(ownerAddress) }</Button>
                  <Box ml="2">
                    <Link className="router-link" to={'/account/' + ownerAddress}>▒▒</Link>
                  </Box>
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        )
      }
      break;
    }
    default:
      break;
  }
  
  return (
    <Card>
      <DataList.Root orientation={props.orientation}>
        <DataList.Item>
          <DataList.Label>Event:</DataList.Label>
          <DataList.Value>
            <Badge>0x{ data.event.toString(16) }</Badge>
          </DataList.Value>
        </DataList.Item>
        {
          data.args.map((item, index) => 
            <DataList.Item key={index}>
              <DataList.Label>Parameter {index + 1}:</DataList.Label>
              <DataList.Value>{ parameterToString(item) }</DataList.Value>
            </DataList.Item>
          )
        }
      </DataList.Root>
    </Card>
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
                  state.balances[ownerAddress] && Object.keys(state.balances[ownerAddress]).map((asset) => {
                    const value = state.balances[ownerAddress][asset];
                    return (
                      <Badge key={transaction.hash + asset} size="1" radius="medium" color={value.balance.gt(0) ? 'green' : (value.balance.isNegative() ? 'red' : 'gray')} style={{ textTransform: 'uppercase' }}>{ Readability.toMoney(value.asset, value.balance, true) }</Badge>
                    )
                  })
                }
                {
                  Object.keys(state.transactions).map((hash) => {
                    const pending = state.transactions[hash];
                    return <Badge key={hash} size="1" radius="medium" color={pending ? 'jade' : 'tomato'}>{ pending ? '+' : '-' }{ Readability.toAddress(hash) }</Badge>
                  })
                }
                {
                  Object.keys(state.witnesses.transactions).map((asset) => {
                    const transactions = state.witnesses.transactions[asset];
                    return transactions.map((tx) => <Badge key={tx.asset.toHex() + tx.transactionId} size="1" radius="medium" color="gold">&{ Readability.toAddress(tx.transactionId) }</Badge>)
                  })
                }
                {
                  Object.keys(state.witnesses.addresses).map((asset) => {
                    const aliases = state.witnesses.addresses[asset].aliases;
                    return aliases.map((alias) => <Badge key={alias} size="1" radius="medium" color="green">+{ Readability.toAddress(alias) }</Badge>)
                  })
                }
                {
                  Object.keys(state.program.receipts).length > 0 &&
                  <Badge size="1" radius="medium" color="gold">{ Readability.toCount('receipt', Object.keys(state.program.receipts).length) }</Badge>
                }
                {
                  state.program.elections.size > 0 &&
                  <Badge size="1" radius="medium" color="green">{ Readability.toCount('election', state.program.elections.size) }</Badge>
                }
                {
                  !state.errors.length &&
                  !state.balances[ownerAddress] &&
                  !Object.keys(state.transactions).length &&
                  !Object.keys(state.witnesses.addresses).length &&
                  !Object.keys(state.witnesses.transactions).length &&
                  !Object.keys(state.program.receipts).length &&
                  !state.program.elections.size &&
                  <Badge size="1" radius="medium" color="gray">Eventless program interaction</Badge>
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
          <ContractFields orientation={orientation} transaction={transaction}></ContractFields>
          {
            receipt?.events && receipt.events.length > 0 &&
            <>
              <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
              {
                receipt.events.map((item: any, index: number) =>
                  <Box key={index} mb={index == receipt.events.length - 1 ? '0' : '4'}>
                    <EventField orientation={orientation} event={item}></EventField>
                  </Box>
                )
              }
            </>
          }
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  )
}