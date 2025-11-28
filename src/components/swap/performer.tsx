import { Button, Spinner, Tooltip } from "@radix-ui/themes";
import { CSSProperties, useCallback, useState } from "react";
import { Swap } from "../../core/swap";
import { AlertBox, AlertType } from "./../alert";
import { mdiSetRight } from "@mdi/js";
import { AuthEntity, ByteUtil, Hashing } from "tangentsdk";
import { useNavigate } from "react-router";
import Icon from "@mdi/react";
import { randomBytes } from "@noble/hashes/utils";

export enum Authorization {
  Account = 'authorize/account',
  OrderCreation = 'authorize/order/creation',
  OrderDeletion = 'authorize/order/deletion',
  PoolCreation = 'authorize/pool/creation',
  PoolDeletion = 'authorize/pool/deletion'
}

export default function PerformerButton(props: { title: string, description: string, disabled?: boolean, variant?: string, color?: string, style?: CSSProperties, type: Authorization, onData?: () => Record<string, any> }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const build = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      const id = Swap.getPipeId();
      if (!id)
        throw new Error('No connection to API server');

      const args: Record<string, any> = props.onData ? props.onData() || { } : { };
      const result = await fetch(`${Swap.location}/${props.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'challenge',
            challenge: ByteUtil.uint8ArrayToHexString(Hashing.hash256(randomBytes(32))),
            id: id,
            ...args
        })
      });
      const entity: AuthEntity = await result.json();
      if (!entity || !entity.sign.message)
        throw new Error('Entity was not built');

      navigate(`/interaction?type=approve&transaction=${entity.sign.message}${entity.sign.asset != null ? '&asset=' + entity.sign.asset : ''}`);
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Build failed: ' + exception.message);
    }
    setLoading(false);
  }, [loading, props.type, props.onData]);
  
  return (
    <Tooltip content={props.description}>
      <Button variant={props.variant as any || 'soft'} color={props.color as any} style={props.style} disabled={props.disabled || loading} onClick={() => build()}>
        <Spinner loading={loading}>
          <Icon path={mdiSetRight} size={0.75}></Icon>
        </Spinner>
        { loading ? 'Building...' : props.title }
      </Button>
    </Tooltip>
  );
}