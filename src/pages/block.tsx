import { Link, useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Flex, IconButton } from "@radix-ui/themes";
import { mdiArrowLeftBoldCircleOutline, mdiArrowRightBoldCircleOutline, mdiCubeOutline, mdiListStatus, mdiOpenInNew } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { UiUtil, lerp } from "tangentsdk/ui";
import { AssetId, Chain } from "tangentsdk/algorithm";
import { RPC } from "tangentsdk/rpc";
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
  const supply = useMemo(() => {
    if (!block)
      return null;

    const blockNumber = block.number.toNumber();
    const genesisLength = 5000;
    const genesisReward = new BigNumber(40);
    const cycleLength = 500000;
    const cycleReward = new BigNumber(1.2);
    const thresholdReward = new BigNumber(0.0002);
    const cycles = Math.ceil(blockNumber / cycleLength);
    let total = genesisReward.multipliedBy(Math.min(genesisLength, blockNumber)).plus(cycleReward.multipliedBy(Math.max(0, (Math.min(blockNumber, cycleLength) - genesisLength))));
    for (let i = 1; i < cycles; i++) {
        const coinbase = BigNumber.max(cycleReward.multipliedBy(1 - i * 0.01), thresholdReward);
        total = total.plus(coinbase.multipliedBy(i == cycles - 1 ? blockNumber % cycleLength : cycleLength));
    }
    return total;
  }, [block]);
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

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    AlertBox.open(AlertType.Info, label + ' copied!');
  };
  const gasPercent = (use: BigNumber, limit: number) => (use || new BigNumber(0)).div(limit > 0 ? limit : 1).toNumber() * 100;

  if (block != null) {
    if (!AppData.tip || block.number.gt(AppData.tip))
      AppData.tip = block.number;

    const time = block.evaluation_time.minus(block.generation_time).toNumber();
    const priority: number = block.priority.toNumber();
    const subpriority = priority == 0 && (AppData.tip || new BigNumber(0)).lte(block.number) ? 0 : priority;
    const possibility = 100 * Math.min(1, Math.max(0, (subpriority > 0 ? 0.4 : 0.0) + Math.min(0.55, lerp(0.0, 0.55, subpriority / Chain.policy.PRODUCTION_COMMITTEE))));
    const confirmations = AppData.tip != null ? AppData.tip.minus(block.number).plus(1) : null;
    return (
      <Box pt="4" pb="8" maxWidth="680px" mx="auto">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div className="page-title num" style={{ fontSize: 20 }}>Block #{ UiUtil.toValue(null, block.number, false, false) }</div>
          <Flex gap="2" align="center">
            <IconButton variant="ghost" size="2" color="gray" disabled={block.number <= 1} onClick={() => nextBlock(block.number.toNumber() - 1)}>
              <Icon path={mdiArrowLeftBoldCircleOutline} size={1.2} />
            </IconButton>
            <IconButton variant="ghost" size="2" color="gray" loading={loading} disabled={!loading && !hasChildBlock} onClick={() => nextBlock(block.number.toNumber() + 1)}>
              <Icon path={mdiArrowRightBoldCircleOutline} size={1.2} />
            </IconButton>
            {
              confirmations != null &&
              <span className={'badge ' + (confirmations.gt(2) ? 'ok' : 'warn')}>{ UiUtil.toCount('confirmation', confirmations).toUpperCase() }</span>
            }
          </Flex>
        </div>
        <div className="card">
          <div className="card-title">Brief</div>
          <div className="dl">
            <div className="dl-row">
              <span className="dl-k">Block hash</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.hash, 'Block hash')}>{ UiUtil.toAddress(block.hash) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Parent hash</span>
              <Link className="dl-v mono router-link" style={{ color: 'var(--info)' }} to={'/block/' + block.parent_hash}>{ UiUtil.toAddress(block.parent_hash) }</Link>
            </div>
            <div className="dl-row">
              <span className="dl-k">Tx root</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.transaction_root, 'Merkle root hash')}>{ UiUtil.toAddress(block.transaction_root) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">State root</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.state_root, 'Merkle root hash')}>{ UiUtil.toAddress(block.state_root) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Producer</span>
              <span className="dl-v"><span className="copyable" onClick={() => { navigator.clipboard.writeText(block.producer); AlertBox.open(AlertType.Info, 'Address copied!') }}>{ UiUtil.toAddress(block.producer) }</span><Link className="dl-open router-link" to={'/account/' + block.producer}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Leader priority</span>
              <span className="dl-v">{ priority >= Chain.policy.PRODUCTION_COMMITTEE ? 'Operate leader #' + (priority + 1) : priority > 0 ? 'Fallback #' + (priority + 1) : 'Normal #1' }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Timestamp</span>
              <span className="dl-v num">{ new Date(block.evaluation_time.toNumber()).toLocaleString() }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Fork possibility</span>
              <span className={'dl-v num ' + (possibility > 50 ? 'down' : possibility > 0 ? '' : 'up')}>≈ { possibility.toFixed(2) }%</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Coinbase</span>
              <span className="dl-v num up">{ UiUtil.toMoney(new AssetId(), block.coinbase, true) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Difficulty</span>
              <span className="dl-v num">{ UiUtil.toUnit(block.pow.kdifficulty) }{ block.pow.mdifficulty > 1 && <span className="down"> +{ ((block.pow.mdifficulty.toNumber() * 100) - 100).toFixed(2) + '%' }</span> }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Gas use</span>
              <span className="dl-v num">{ block.gas_use.toNumber().toLocaleString() } / { block.gas_limit.toNumber().toLocaleString() } · { gasPercent(block.gas_use, block.gas_limit).toFixed(2) }%</span>
            </div>
          </div>
          <div className="meter"><div style={{ width: Math.min(100, gasPercent(block.gas_use, block.gas_limit)) + '%' }}></div></div>
        </div>
        <div className="tiny dim" style={{ marginTop: 10, textAlign: 'center' }}>
          { UiUtil.toCount('transaction', block.transaction_count) } · { UiUtil.toCount('transition', block.transition_count) } · { UiUtil.toCount('block', block.slot.length) } in { UiUtil.toTimespan(new BigNumber(block.slot.duration_total).plus(time)) }
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">Technical</div>
          <div className="dl">
            <div className="dl-row">
              <span className="dl-k">Proof of work</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.pow.proof, 'Block proof')}>{ UiUtil.toAddress(block.pow.proof) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Receipt root</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.receipt_root, 'Merkle root hash')}>{ UiUtil.toAddress(block.receipt_root) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Producer proof</span>
              <span className="dl-v mono copyable" onClick={() => copy(block.signature, 'Block signature')}>{ UiUtil.toAddress(block.signature) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Absolute work</span>
              <span className="dl-v num">{ UiUtil.toCount('weight unit', block.absolute_work) }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Supply</span>
              <span className="dl-v num">{ UiUtil.toMoney(new AssetId(), supply) }</span>
            </div>
            {
              block.witnesses.map((item: any) =>
                <div className="dl-row" key={item.asset.chain + item.number.toString()}>
                  <span className="dl-k">Tangent to { item.asset.chain }</span>
                  <span className="dl-v num">block #{ UiUtil.toValue(null, item.number, false, false) }</span>
                </div>
              )
            }
            <div className="dl-row">
              <span className="dl-k">Slot block time</span>
              <span className="dl-v num">{ UiUtil.toTimespan(block.slot.duration_average) } per block</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Slot congestion</span>
              <span className="dl-v">{ block.slot.congestion ? 'Min gas price applies' : 'No min gas price' }</span>
            </div>
            <div className="dl-row">
              <span className="dl-k">Slot gas use</span>
              <span className="dl-v num">{ block.slot.gas_use.toNumber().toLocaleString() } / { block.slot.gas_limit.toNumber().toLocaleString() } · { gasPercent(block.slot.gas_use, block.slot.gas_limit).toFixed(2) }%</span>
            </div>
          </div>
          <div className="meter"><div style={{ width: Math.min(100, gasPercent(block.slot.gas_use, block.slot.gas_limit)) + '%', background: 'var(--warn)' }}></div></div>
        </div>
        {
          block.transactions.length > 0 &&
          <div className="card rows" style={{ marginTop: 14 }}>
            <div className="card-title" style={{ padding: '12px 0 2px' }}>Transactions</div>
            {
              block.transactions.map((hash: any, index: number) =>
                <Link key={hash} to={'/transaction/' + hash} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
                  <div className="tx-row">
                    <span className="tx-ico"><Icon path={mdiCubeOutline} size={1}></Icon></span>
                    <div className="tx-main">
                      <div className="tx-title">Transaction #{ index + 1 }</div>
                      <div className="tx-meta mono" style={{ fontSize: 11 }}>{ UiUtil.toAddress(hash) }</div>
                    </div>
                    <div className="tx-time">›</div>
                  </div>
                </Link>
              )
            }
          </div>
        }
      </Box>
    )
  } else if (loading) {
    return (
      <Box pt="4" maxWidth="680px" mx="auto">
        <div className="card">
          <div className="skel" style={{ height: 28, width: '50%' }}></div>
          <div className="skel" style={{ height: 20, marginTop: 14 }}></div>
          <div className="skel" style={{ height: 20, marginTop: 10 }}></div>
          <div className="skel" style={{ height: 20, marginTop: 10 }}></div>
        </div>
      </Box>
    )
  } else {
    return (
      <Box pt="4" pb="8" maxWidth="680px" mx="auto">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div className="page-title num" style={{ fontSize: 20 }}>Block</div>
          <span className="badge warn">PENDING</span>
        </div>
        <div className="callout warn">
          <Icon path={mdiListStatus} size={1}></Icon>
          <span>
            Awaiting block — it will appear here shortly after a node submits it.
            When the network is busy it can take a while to propagate.
            If it does not show up after 10 minutes then this block either got dropped or was not created.
          </span>
        </div>
        {
          blockETA != null &&
          <div className="card" style={{ marginTop: 14 }}>
            <div className="dl">
              <div className="dl-row">
                <span className="dl-k">Block number</span>
                <span className="dl-v num">{ UiUtil.toValue(null, blockETA.blockNumber, false, false) }</span>
              </div>
              <div className="dl-row">
                <span className="dl-k">Block countdown</span>
                <span className="dl-v num">{ UiUtil.toValue(null, blockETA.blockDelta.negated(), true, false) } · { new BigNumber(1).minus(blockETA.blockNumber.minus(blockETA.blockDelta).dividedBy(blockETA.blockNumber)).multipliedBy(100).toFixed(3) }% left</span>
              </div>
              <div className="dl-row">
                <span className="dl-k">Estimated date</span>
                <span className="dl-v num">{ blockETA.blockDate.toLocaleString() }</span>
              </div>
            </div>
          </div>
        }
      </Box>
    )
  }
}