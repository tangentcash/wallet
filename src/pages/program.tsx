import { useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { Box, Button } from "@radix-ui/themes";
import { mdiAlertCircleOutline, mdiContentCopy, mdiOpenInNew } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { RPC } from "tangentsdk/rpc";
import { UiUtil } from "tangentsdk/ui";
import Icon from "@mdi/react";

export default function ProgramPage() {
  const params = useParams();
  const [program, setProgram] = useState<{ hashcode: string, storage: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffectAsync(async () => {
    try {
      const id = params.id;
      if (!id)
        throw false;

      const result = await RPC.getWitnessProgram(id);
      if (!result)
        throw false;

      setProgram(result);
    } catch {
      setProgram(null);
    }
    setLoading(false);
  }, [params]);

  if (program != null) {
    const lines = (program.storage || '').split('\n');
    const width = lines.length.toString().length;
    return (
      <Box pt="4" pb="8" mx="auto" maxWidth="1400px">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 19 }}>Program</div>
          <span className="badge flat mono" style={{ cursor: 'pointer' }} onClick={() => {
            navigator.clipboard.writeText(program.hashcode);
            AlertBox.open(AlertType.Info, 'Program hash copied!');
          }}>{ UiUtil.toHash(program.hashcode, 10) }</span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <span className="mono tiny dim">source code</span>
            <span className="badge info">DEPLOYED</span>
          </div>
          <pre className="mono tiny" style={{ padding: 16, margin: 0, lineHeight: 1.7, overflowX: 'auto', color: 'var(--text-2)' }}>
            {
              lines.map((line, index) =>
                <span key={index}><span style={{ color: 'var(--text-3)', marginRight: 12, userSelect: 'none' }}>{ (index + 1).toString().padStart(width, '0') }</span>{ line }{'\n'}</span>
              )
            }
          </pre>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Button className="btn-soft" style={{ flex: 1 }} onClick={() => {
            navigator.clipboard.writeText(program.storage);
            AlertBox.open(AlertType.Info, 'Program code copied!');
          }}><Icon path={mdiContentCopy} size={0.75}></Icon> Copy source</Button>
          <Button className="btn-ghost" style={{ flex: 1 }} onClick={() => {
            navigator.clipboard.writeText(window.location.origin + '/program/' + program.hashcode);
            AlertBox.open(AlertType.Info, 'Program link copied!');
          }}><Icon path={mdiOpenInNew} size={0.75}></Icon> Copy link</Button>
        </div>
      </Box>
    )
  } else if (loading) {
    return (
      <Box pt="4" pb="8" mx="auto" maxWidth="1400px">
        <div className="card">
          <div className="skel" style={{ height: 24, width: '40%' }}></div>
          <div className="skel" style={{ height: 260, marginTop: 14 }}></div>
        </div>
      </Box>
    )
  } else {
    return (
      <Box pt="4" pb="8" mx="auto" maxWidth="1400px">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 19 }}>Program</div>
          <span className="badge err">NOT FOUND</span>
        </div>
        <div className="callout err">
          <Icon path={mdiAlertCircleOutline} size={1}></Icon>
          <span><b>{ UiUtil.toHash(params.id || '', 10) }</b> isn't a deployed program on this network.</span>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="tiny dim" style={{ lineHeight: 1.7 }}>
            1. The contract hashcode may be incorrectly formatted or contain typos in the hexadecimal string.<br></br>
            2. The contract might not have been successfully deployed or was deployed to a different hashcode than expected.<br></br>
            3. The node may not have indexed or synchronized the contract data yet.
          </div>
        </div>
        <Button className="btn-soft btn-block" style={{ marginTop: 12 }} onClick={() => history.back()}>Go back</Button>
      </Box>
    )
  }
}
