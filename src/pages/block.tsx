import { Link, useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/extensions/react";
import { useCallback, useState } from "react";
import { Interface, Netstat } from "../core/wallet";
import { Badge, Box, Button, Card, DataList, Flex, Heading, IconButton, Spinner, Table } from "@radix-ui/themes";
import { mdiArrowLeftBoldCircleOutline, mdiArrowRightBoldCircleOutline, mdiBackburger } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { Readability } from "../core/text";
import Icon from "@mdi/react";
import { Chain } from "../core/tangent/algorithm";

export default function BlockPage() {
  const params = useParams();
  const [block, setBlock] = useState<any>(null);
  const [hasChildBlock, setHasChildBlock] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const nextBlock = useCallback((number: number) => {
    setBlock(null);
    setHasChildBlock(true);
    setLoading(true);
    navigate('/block/' + number);
  }, []);
  useEffectAsync(async () => {
    try {
      const id = params.id;
      if (!id)
        throw false;

      const number = parseInt(id);
      const result = await (!isNaN(number) && number > 0 ? Interface.getBlockByNumber(number, 1) : Interface.getBlockByHash(id, 1));
      if (!result)
        throw false;

      setBlock(result);
      try {
        const childBlock = await Interface.getBlockByNumber(result.number.toNumber() + 1);
        setHasChildBlock(childBlock != null);
      } catch {
        setHasChildBlock(false);
      }
    } catch (exception) {
      setTimeout(() => AlertBox.open(AlertType.Error, 'Block not found: ' + (exception as Error).message), 200);
      navigate('/');
    }
    setLoading(false);
  }, [params]);

  if (block != null) {
    const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
    const time = block.approval_time.minus(block.proposal_time).toNumber();
    const confidence = Math.min(100 * (1.0 - block.priority.toNumber() / Chain.props.PROPOSER_COMMITTEE), 99.99);
    if (block.number.gt(Netstat.blockTipNumber))
      Netstat.blockTipNumber = block.number;
    
    return (
      <Box px="4" pt="4">
        <Flex justify="between" align="center">
          <Heading size="6">Block</Heading>
          <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
            <Icon path={mdiBackburger} size={0.7} /> BACK
          </Button>
        </Flex>
        <Card variant="surface" mt="4">
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Block hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.hash);
                  AlertBox.open(AlertType.Info, 'Block hash copied!')
                }}>{ block.hash.substring(0, 16) }...{ block.hash.substring(block.hash.length - 16) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Block number:</DataList.Label>
              <DataList.Value>
                { block.number.toString() }
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.hash}>▒▒</Link>
                </Box>
                <Badge ml="2" color={block.priority > 0 ? 'yellow' : 'green'}>P{block.priority.toNumber() + 1} / { confidence.toFixed(2) }%{ Netstat.blockTipNumber != null ? ' / ' + Readability.toCount('confirmation', Netstat.blockTipNumber.minus(block.number)) : ''}</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Parent hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.parent_hash);
                  AlertBox.open(AlertType.Info, 'Parent hash copied!')
                }}>{ block.parent_hash.substring(0, 16) }...{ block.parent_hash.substring(block.parent_hash.length - 16) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.parent_hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                <Badge color={block.recovery.gt(0) ? 'red' : 'gray'}>{ block.recovery.gt(0) ? 'Recovery' : 'Extension' }  in { Readability.toTimespan(time) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Time:</DataList.Label>
              <DataList.Value>{ new Date(block.approval_time.toNumber()).toLocaleString() }</DataList.Value>
            </DataList.Item>
            {
              block.witnesses.length > 0 &&
              block.witnesses.map((item: any) => {
                <DataList.Item key={item.asset.chain + item.number.toString()}>
                  <DataList.Label>Witnessed by:</DataList.Label>
                  <DataList.Value>
                    <Badge color="gray" >{ item.asset.chain } block number #{ item.number.toString() }</Badge>
                  </DataList.Value>
                </DataList.Item>
              })
            }
            <DataList.Item>
              <DataList.Label>Transactions merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.transactions_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ block.transactions_root.substring(0, 16) }...{ block.transactions_root.substring(block.transactions_root.length - 16) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Receipts merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.receipts_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ block.receipts_root.substring(0, 16) }...{ block.receipts_root.substring(block.receipts_root.length - 16) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Transactions:</DataList.Label>
              <DataList.Value>{ Readability.toCount('transaction', block.transactions_count) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>States merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.states_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ block.states_root.substring(0, 16) }...{ block.states_root.substring(block.states_root.length - 16) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>States:</DataList.Label>
              <DataList.Value>{ Readability.toCount('state', block.states_count) } | { Readability.toCount('update', block.mutations_count) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Signature:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.signature);
                  AlertBox.open(AlertType.Info, 'Block signature copied!')
                }}>{ block.signature.substring(0, 16) }...{ block.signature.substring(block.signature.length - 16) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Wesolowski proof:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.wesolowski);
                  AlertBox.open(AlertType.Info, 'Block proof copied!')
                }}>{ block.wesolowski.substring(0, 16) }...{ block.wesolowski.substring(block.wesolowski.length - 16) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Proof difficulty:</DataList.Label>
              <DataList.Value>
                <Badge color="red">{ Readability.toUnit(block.difficulty) } in { Readability.toTimespan(block.wesolowski_time) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Proposer account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.proposer);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ block.proposer.substring(0, 16) }...{ block.proposer.substring(block.proposer.length - 16) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + block.proposer}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Absolute work:</DataList.Label>
              <DataList.Value>{ Readability.toUnit(block.absolute_work) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas limit:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.gas_limit) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas use:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.gas_use) } | { (block.gas_use.div(block.gas_limit).toNumber() * 100).toFixed(2) }%</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot status:</DataList.Label>
              <DataList.Value>
                <Badge color="yellow">{ Readability.toCount('block', block.slot_length) } in { Readability.toTimespan(block.slot_duration) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot gas work:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.slot_gas_use.multipliedBy(block.slot_length)) } | { Readability.toGas(block.slot_gas_target) } per block</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot gas target:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.slot_gas_target) } per block</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <Table.Root variant="surface" size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Tx number</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tx hash</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {
                block.transactions.map((hash: any, index: number) =>
                  <Table.Row key={hash}>
                    <Table.RowHeaderCell>{ index + 1 }</Table.RowHeaderCell>
                    <Table.Cell>
                      <Flex>
                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                          navigator.clipboard.writeText(hash);
                          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                        }}>{ hash.substring(0, 16) }...{ hash.substring(hash.length - 16) }</Button>
                        <Box ml="2">
                          <Link className="router-link" to={'/transaction/' + hash}>▒▒</Link>
                        </Box>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                )
              }
            </Table.Body>
          </Table.Root>
        </Card>
        <Flex justify="center" gap="4" pt="6">
          <IconButton variant="ghost" size="2" mb="1" color="gray" disabled={block.number <= 1} onClick={() => nextBlock(block.number.toNumber() - 1)}>
            <Icon path={mdiArrowLeftBoldCircleOutline} size={1.35} />
          </IconButton>
          <IconButton variant="ghost" size="2" mb="1" color="gray" loading={loading} disabled={!loading && !hasChildBlock} onClick={() => nextBlock(block.number.toNumber() + 1)}>
            <Icon path={mdiArrowRightBoldCircleOutline} size={1.35} />
          </IconButton>
        </Flex>
      </Box>
    )
  } else {
    return (
      <Flex justify="center">
        <Spinner size="3" />
      </Flex>
    )
  }
}