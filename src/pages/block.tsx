import { Link, useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useCallback, useState } from "react";
import { Badge, Box, Button, Card, DataList, Flex, Heading, IconButton, Spinner, Table } from "@radix-ui/themes";
import { mdiArrowLeftBoldCircleOutline, mdiArrowRightBoldCircleOutline } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { Chain, RPC, Readability, lerp } from "tangentsdk";
import { AppData } from "../core/app";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

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

      const number = parseInt(id, 10);
      const result = await (!isNaN(number) && number > 0 ? RPC.getBlockByNumber(number, 1) : RPC.getBlockByHash(id, 1));
      if (!result)
        throw false;

      setBlock(result);
      try {
        const childBlock = await RPC.getBlockByNumber(result.number.toNumber() + 1);
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
    if (block.number.gt(AppData.tip))
      AppData.tip = block.number;

    const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
    const time = block.evaluation_time.minus(block.generation_time).toNumber();
    const priority: number = block.priority.toNumber();
    const subpriority = priority == 0 && (AppData.tip || new BigNumber(0)).lte(block.number) ? 0 : priority;
    const possibility = 100 * Math.min(1, Math.max(0, (subpriority > 0 ? 0.4 : 0.0) + Math.min(0.55, lerp(0.0, 0.55, subpriority / Chain.props.PRODUCTION_COMMITTEE))));
    return (
      <Box px="4" pt="4" maxWidth="800px" mx="auto">
        <Heading size="6">Block</Heading>
        <Card variant="surface" mt="4">
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Block number:</DataList.Label>
              <DataList.Value>
                { block.number.toString() }
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.hash}>▒▒</Link>
                </Box>
                <Badge ml="2" color={priority > 0 ? (possibility > 50 ? 'red' : 'yellow') : 'jade'}>{ 'Fork possibility ≈ ' + possibility.toFixed(2) }%</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Block hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.hash);
                  AlertBox.open(AlertType.Info, 'Block hash copied!')
                }}>{ Readability.toHash(block.hash, 12) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Parent hash:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.parent_hash);
                  AlertBox.open(AlertType.Info, 'Parent hash copied!')
                }}>{ Readability.toHash(block.parent_hash, 12) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.parent_hash}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Signature:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.signature);
                  AlertBox.open(AlertType.Info, 'Block signature copied!')
                }}>{ Readability.toHash(block.signature, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Proof:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.proof);
                  AlertBox.open(AlertType.Info, 'Block proof copied!')
                }}>{ Readability.toHash(block.proof, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>TX merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.transaction_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.transaction_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>RC merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.receipt_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.receipt_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>SV merkle root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.state_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.state_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Producer account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.producer);
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(block.producer) }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/account/' + block.producer}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Leader priority:</DataList.Label>
              {
                priority >= Chain.props.PRODUCTION_COMMITTEE &&
                <DataList.Value>
                  <Badge color="red">Oprate leader #{ priority + 1 }</Badge>
                </DataList.Value>
              }
              {
                priority < Chain.props.PRODUCTION_COMMITTEE &&
                <DataList.Value>{ priority > 0 ? 'Fallback #' + (priority + 1) : 'Normal #1' }</DataList.Value>
              }
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                <Badge color="gray">Extension in { Readability.toTimespan(time) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Timestamp:</DataList.Label>
              <DataList.Value>{ new Date(block.evaluation_time).toLocaleString() }</DataList.Value>
            </DataList.Item>
            {
              block.witnesses.map((item: any) => {
                return (
                  <DataList.Item key={item.asset.chain + item.number.toString()}>
                    <DataList.Label>Witnessed by:</DataList.Label>
                    <DataList.Value>
                      <Badge color="gray">{ item.asset.chain } block number #{ item.number.toString() }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                )
              })
            }
            <DataList.Item>
              <DataList.Label>Time:</DataList.Label>
              <DataList.Value>{ new Date(block.evaluation_time.toNumber()).toLocaleString() }</DataList.Value>
            </DataList.Item>
            {
              AppData.tip != null &&
              <DataList.Item>
                <DataList.Label>Confidence:</DataList.Label>
                <DataList.Value>
                  <Badge color="orange">{ Readability.toCount('confirmation', AppData.tip.minus(block.number).plus(1)) }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Transactions:</DataList.Label>
              <DataList.Value>{ Readability.toCount('transaction', block.transaction_count) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>States:</DataList.Label>
              <DataList.Value>{ Readability.toCount('state', block.state_count) } | { Readability.toCount('update', block.mutation_count) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Proof difficulty:</DataList.Label>
              {
                block.difficulty_multiplier > 1 &&
                <DataList.Value>
                  <Badge color="red">{ Readability.toCount('op', block.difficulty) } +{ ((block.difficulty_multiplier.toNumber() * 100) - 100).toFixed(2) + '%' }</Badge>
                </DataList.Value>
              }
              {
                block.difficulty_multiplier <= 1 &&
                <DataList.Value>{ Readability.toCount('op', block.difficulty) }</DataList.Value>
              }
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
              <DataList.Value>{ Readability.toGas(block.gas_use) } | { (block.gas_use.div(block.gas_limit.gt(0) ? block.gas_limit : 1).toNumber() * 100).toFixed(2) }%</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Slot activity:</DataList.Label>
              <DataList.Value>
                <Badge color="yellow">{ Readability.toCount('block', block.slot_length) } in { Readability.toTimespan(block.slot_duration) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot time average:</DataList.Label>
              <DataList.Value>{ Readability.toTimespan(block.slot_duration_average) } per block</DataList.Value>
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
                        }}>{ Readability.toHash(hash, document.body.clientWidth < 500 ? 6 : 12) }</Button>
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
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  }
}