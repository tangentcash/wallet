import { Link, useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Callout, Card, DataList, Flex, Heading, IconButton, Progress, Spinner, Table, Text } from "@radix-ui/themes";
import { mdiArrowLeftBoldCircleOutline, mdiArrowRightBoldCircleOutline, mdiListStatus } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, Chain, RPC, Readability, lerp } from "tangentsdk";
import { AppData } from "../core/app";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

export default function BlockPage() {
  const params = useParams();
  const [block, setBlock] = useState<any>(null);
  const [hasChildBlock, setHasChildBlock] = useState(true);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const blockETA = useMemo((): { blockNumber: BigNumber, blockDelta: BigNumber, blockDate: Date } | null => {
    if (!params.id)
      return null;

    const number = parseInt(params.id, 10);
    if (isNaN(number) || !isFinite(number) || !Number.isSafeInteger(number))
      return null;

    const index = new BigNumber(number);
    const time = new Date().getTime();
    const delta = AppData.tip ? BigNumber.max(1, index.minus(AppData.tip)) : new BigNumber(1);
    return {
      blockNumber: index,
      blockDelta: delta,
      blockDate: new Date(time + Chain.policy.BLOCK_TIME * delta.toNumber())
    }
  }, [params.id, timeoutId]);
  const nextBlock = useCallback((number: number) => {
    setBlock(null);
    setHasChildBlock(true);
    setLoading(true);
    navigate('/block/' + number);
  }, []);
  const fetchBlock = useCallback(async () => {
    let retry = true;
    try {
      if (!params.id)
        throw false;

      await AppData.sync();
      const number = parseInt(params.id, 10);
      const result = await (!isNaN(number) && number > 0 ? RPC.getBlockByNumber(number, 1) : RPC.getBlockByHash(params.id, 1));
      if (!result)
        throw false;

      retry = false;
      setBlock(result);
      try {
        const childBlock = await RPC.getBlockByNumber(result.number.toNumber() + 1);
        setHasChildBlock(childBlock != null);
      } catch {
        setHasChildBlock(false);
      }
    } catch {
      setBlock(null);
    }

    if (retry) {
      setTimeoutId(setTimeout(() => fetchBlock(), Chain.policy.BLOCK_TIME) as any);
    } else {
      setTimeoutId(null);
    }
  }, [params.id]);
  useEffectAsync(async () => {
    setLoading(true);
    await fetchBlock();
    setLoading(false);
  }, [fetchBlock]);
  useEffect(() => {
    return () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    }
  }, [timeoutId]);

  if (block != null) {
    if (!AppData.tip || block.number.gt(AppData.tip))
      AppData.tip = block.number;

    const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
    const time = block.evaluation_time.minus(block.generation_time).toNumber();
    const priority: number = block.priority.toNumber();
    const subpriority = priority == 0 && (AppData.tip || new BigNumber(0)).lte(block.number) ? 0 : priority;
    const possibility = 100 * Math.min(1, Math.max(0, (subpriority > 0 ? 0.4 : 0.0) + Math.min(0.55, lerp(0.0, 0.55, subpriority / Chain.policy.PRODUCTION_COMMITTEE))));
    return (
      <Box px="4" pt="4" maxWidth="800px" mx="auto">
        <Flex justify="between" align="center">
          <Heading size="6">Block</Heading>
          <Flex justify="center" gap="4">
            <IconButton variant="ghost" size="2" mb="1" color="gray" disabled={block.number <= 1} onClick={() => nextBlock(block.number.toNumber() - 1)}>
              <Icon path={mdiArrowLeftBoldCircleOutline} size={1.35} />
            </IconButton>
            <IconButton variant="ghost" size="2" mb="1" color="gray" loading={loading} disabled={!loading && !hasChildBlock} onClick={() => nextBlock(block.number.toNumber() + 1)}>
              <Icon path={mdiArrowRightBoldCircleOutline} size={1.35} />
            </IconButton>
          </Flex>
        </Flex>
        <Card variant="surface" mt="4">
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Block number:</DataList.Label>
              <DataList.Value>
                { block.number.toString() }
                <Box ml="2">
                  <Link className="router-link" to={'/block/' + block.hash}>▒▒</Link>
                </Box>
                <Badge ml="2" color={priority > 0 ? (possibility > 50 ? 'red' : 'yellow') : 'lime'}>{ 'Fork possibility ≈ ' + possibility.toFixed(2) }%</Badge>
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
              <DataList.Label>Proof of work:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.pow.proof);
                  AlertBox.open(AlertType.Info, 'Block proof copied!')
                }}>{ Readability.toHash(block.pow.proof, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Transaction root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.transaction_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.transaction_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Receipt root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.receipt_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.receipt_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>State root:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.state_root);
                  AlertBox.open(AlertType.Info, 'Merkle root hash copied!')
                }}>{ Readability.toHash(block.state_root, 12) }</Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Producer proof:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(block.signature);
                  AlertBox.open(AlertType.Info, 'Block signature copied!')
                }}>{ Readability.toHash(block.signature, 12) }</Button>
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
                priority >= Chain.policy.PRODUCTION_COMMITTEE &&
                <DataList.Value>
                  <Badge color="red">Oprate leader #{ priority + 1 }</Badge>
                </DataList.Value>
              }
              {
                priority < Chain.policy.PRODUCTION_COMMITTEE &&
                <DataList.Value>{ priority > 0 ? 'Fallback #' + (priority + 1) : 'Normal #1' }</DataList.Value>
              }
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                <Badge color="gray">Extension in { Readability.toTimespan(time) }</Badge>
              </DataList.Value>
            </DataList.Item>
            {
              block.witnesses.map((item: any) => {
                return (
                  <DataList.Item key={item.asset.chain + item.number.toString()}>
                    <DataList.Label>Tangent to:</DataList.Label>
                    <DataList.Value>
                      <Badge color="gray">{ item.asset.chain } block number #{ Readability.toValue(null, item.number, false, false) }</Badge>
                    </DataList.Value>
                  </DataList.Item>
                )
              })
            }
            <DataList.Item>
              <DataList.Label>Timestamp:</DataList.Label>
              <DataList.Value>{ new Date(block.evaluation_time.toNumber()).toLocaleString() }</DataList.Value>
            </DataList.Item>
            {
              AppData.tip != null &&
              <DataList.Item>
                <DataList.Label>Confidence:</DataList.Label>
                <DataList.Value>
                  <Badge color="yellow">{ Readability.toCount('confirmation', AppData.tip.minus(block.number).plus(1)) }</Badge>
                </DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Coinbase:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(new AssetId(), block.coinbase) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Difficulty:</DataList.Label>
              {
                block.pow.mdifficulty > 1 &&
                <DataList.Value>
                  <Badge color="red">{ Readability.toUnit(block.pow.kdifficulty) } +{ ((block.pow.mdifficulty.toNumber() * 100) - 100).toFixed(2) + '%' }</Badge>
                </DataList.Value>
              }
              {
                block.pow.mdifficulty <= 1 &&
                <DataList.Value>{ Readability.toUnit(block.pow.kdifficulty) }</DataList.Value>
              }
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Absolute work:</DataList.Label>
              <DataList.Value>{ Readability.toCount('weight unit', block.absolute_work) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Transactions:</DataList.Label>
              <DataList.Value>{ Readability.toCount('transaction', block.transaction_count) } | { Readability.toValue(null, new BigNumber(1000).multipliedBy(block.transaction_count).dividedBy(time).toFixed(2), false, false) }/sec.</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Transitions:</DataList.Label>
              <DataList.Value>{ Readability.toCount('transition', block.transition_count) } | { Readability.toValue(null, new BigNumber(1000).multipliedBy(block.transition_count).dividedBy(time).toFixed(2), false, false) }/sec.</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas limit:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.gas_limit) } | &lt; { Readability.toCount('KB', ((block.gas_limit / 32) / 1024).toFixed(2)) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Gas use:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.gas_use) } | { (block.gas_use.div(block.gas_limit.gt(0) ? block.gas_limit : 1).toNumber() * 100).toFixed(2) }%</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          <Box mt="2">
            <Progress variant="surface" size="3" color="yellow" value={block.gas_use.div(block.gas_limit.gt(0) ? block.gas_limit : 1).toNumber() * 100} />
          </Box>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Slot activity:</DataList.Label>
              <DataList.Value>
                <Badge color="yellow">{ Readability.toCount('block', block.slot.length) } in { Readability.toTimespan(new BigNumber(block.slot.duration_total).plus(time)) }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot status:</DataList.Label>
              <DataList.Value>
                <Badge color={block.slot.congestion ? 'red' : 'lime'}>{ block.slot.congestion ? 'Only paid transactions in next block' : 'Costless transactions in next block' }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot block time:</DataList.Label>
              <DataList.Value>{ Readability.toTimespan(block.slot.duration_average) } per block</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot gas limit:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.slot.gas_limit) } | &lt; { Readability.toCount('KB', ((block.slot.gas_limit / 32) / 1024).toFixed(2)) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Slot gas use:</DataList.Label>
              <DataList.Value>{ Readability.toGas(block.slot.gas_use) } | { (block.slot.gas_use.div(block.slot.gas_limit.gt(0) ? block.slot.gas_limit : 1).toNumber() * 100).toFixed(2) }%</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          <Box mt="2">
            <Progress variant="surface" size="3" color="red" value={block.slot.gas_use.div(block.slot.gas_limit.gt(0) ? block.slot.gas_limit : 1).toNumber() * 100} />
          </Box>
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
      </Box>
    )
  } else if (loading) {
    return (
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  } else {
    return (
      <Box px="4" pt="6" maxWidth="800px" mx="auto">
        <Flex align="center" mb="3" gap="2">
          <Spinner size="3"></Spinner>
          <Heading>Awaiting block</Heading>
        </Flex>
        <Callout.Root color="yellow">
          <Callout.Icon>
            <Icon path={mdiListStatus} size={1} />
          </Callout.Icon>
          <Callout.Text>
            <Flex direction="column" gap="2">
              <Text>1. If a node have just submitted a block then it will appear here shortly.</Text>
              <Text>2. When the network is busy it can take a while for a block to propagate through the network.</Text>
              <Text>3. If it still does not show up after 10 minutes then this block either got dropped or was not created.</Text>
            </Flex>
          </Callout.Text>
        </Callout.Root>
        {
          blockETA != null &&
          <Box mt="4">
            <Box style={{ border: '1px dashed var(--gray-8)' }} mb="4"></Box>
            <Flex wrap="wrap" gap="3">
              <Card>
                <Heading size="3">Block number</Heading>
                <Text>{ Readability.toValue(null, blockETA.blockNumber, false, false) }</Text>
              </Card>
              <Card>
                <Heading size="3">Block countdown</Heading>
                <Text>{ Readability.toValue(null, blockETA.blockDelta.negated(), true, false) } | { new BigNumber(1).minus(blockETA.blockNumber.minus(blockETA.blockDelta).dividedBy(blockETA.blockNumber)).multipliedBy(100).toFixed(3) }% left</Text>
              </Card>
              <Card>
                <Heading size="3">Estimated date</Heading>
                <Text>{ blockETA.blockDate.toLocaleString() }</Text>
              </Card>
            </Flex>
          </Box>
        }
      </Box>
    )
  }
}