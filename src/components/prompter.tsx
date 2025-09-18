import { AlertDialog, Avatar, Badge, Button, Card, Flex, IconButton, Separator, Text } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import { Authorizer, ByteUtil, AuthEntity, Signing } from "tangentsdk";
import { Readability } from "../core/text";
import { mdiAlertOutline, mdiCheckboxMarkedCircleOutline } from "@mdi/js";
import { AppData, DecodedTransaction } from "../core/app";
import { AlertBox, AlertType } from "./alert";
import Icon from "@mdi/react";

type Metadata = {
  encodedPublicKey: string | null,
  encodedMessage: string | null,
  decodedTransaction: DecodedTransaction | null,
  kind: string,
  symbol: string,
  trulyTrustless: boolean
}

export class PrompterBox {
  static entity: AuthEntity | null = null;
  static metadata: Metadata | null = null;
  static notify: (() => void) | null = null;
  static resolve: ((approve: boolean) => void) | null = null;

  static open(entity?: AuthEntity): Promise<boolean> {
      if (entity && this.entity) {
        throw new Error('Already prompting another approval');
      }

      this.entity = entity || null;
      if (this.entity) {
        let decodedTransaction: DecodedTransaction | null = null;
        try {
          decodedTransaction = this.entity.sign.message ? AppData.decodeTransaction(this.entity.sign.message) : null;
        } catch (exception: any) {
          console.error(exception);
        }

        const kind = decodedTransaction ? 'transaction' : (this.entity.sign.message ? (this.entity.kind == 'transaction' ? 'message' : this.entity.kind) : 'account');
        const ipAddress = Authorizer.isIpAddress(this.entity.proof.hostname);
        const parts = this.entity.proof.hostname.split('.');
        this.metadata = {
          encodedPublicKey: Signing.encodePublicKey(this.entity.proof.publicKey),
          encodedMessage: this.entity.sign.message ? ByteUtil.uint8ArrayToHexString(this.entity.sign.message) : null,
          decodedTransaction,
          kind: kind,
          symbol: ipAddress ? 'IP' : (parts.length > 1 ? parts[parts.length - 2] : parts[0])[0],
          trulyTrustless: this.entity.proof.trustless && (kind == this.entity.kind || this.entity.kind == null)
        };
        console.log('[ui] prompt', Authorizer.schema(this.entity));

        const result = new Promise<boolean>((resolve) => this.resolve = resolve);
        if (this.notify)
          this.notify();
        
        return result;
      } else {
        this.metadata = null;
        if (this.resolve) {
          this.resolve(false);
          this.resolve = null;
        }
        if (this.notify)
          this.notify();
        return new Promise<boolean>((resolve) => resolve(false));
      }
  }
  static close(): Promise<boolean> {
    return this.open().then(() => true);
  }
  static isOpen(): boolean {
    return this.entity != null && this.metadata != null;
  }
}

export function Prompter() {
  const [notify, setNotify] = useState(0);
  const resolve = useCallback((approve: boolean) => {
    if (PrompterBox.resolve) {
      PrompterBox.resolve(approve);
      PrompterBox.resolve = null;
    }
  }, []);
  const entity = PrompterBox.entity || undefined;
  const metadata = PrompterBox.metadata || undefined;
  PrompterBox.notify = () => setNotify(notify + 1);

  return (
    <AlertDialog.Root open={entity != null} onOpenChange={(open) => PrompterBox.open(open ? entity : undefined)}>
      {
        entity != null && metadata != null &&
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>
            <Flex justify="between" align="center">
              Approve { metadata.kind }
              <Badge size="2" radius="small" color={metadata.trulyTrustless ? 'jade' : 'red'}>{ metadata.trulyTrustless ? 'SECURE' : 'NOT SECURE' }</Badge>
            </Flex>
          </AlertDialog.Title>
          <Card mb="4">
            <Flex justify="between" align="center">
              <Flex gap="2">
                <Avatar src={entity.about.favicon || ''} fallback={metadata.symbol || '?'} size="4" color={metadata.trulyTrustless ? 'jade' : 'amber'} />
                <Flex direction="column" mt="1" gap="1" align="start" justify="center">
                  <Badge color={metadata.trulyTrustless ? 'grass' : 'amber'} size="2">{ entity.proof.hostname }</Badge>
                  <Text color="gray" size="1">{ Readability.toAddress(metadata.encodedPublicKey || '0x00000000') }</Text>
                </Flex>
              </Flex>
              <IconButton variant="soft" size="3" radius="medium" color={metadata.trulyTrustless ? 'grass' : 'amber'} onClick={() => {
                if (entity != null) {
                  navigator.clipboard.writeText(Authorizer.schema(entity));
                  AlertBox.open(AlertType.Info, 'App scheme copied!')
                }
              }}>
                <Icon path={metadata.trulyTrustless ? mdiCheckboxMarkedCircleOutline : mdiAlertOutline} size={1.35} />
              </IconButton>
            </Flex>
          </Card>
          <Flex gap="2" wrap="wrap" mb="2" ml="2">
            <Text size="2">—— Effects:</Text>
            {
              metadata.kind == 'account' &&
              <Badge color="yellow" radius="small" size="1">Address reveal</Badge>
            }
            {
              metadata.kind == 'identity' &&
              <Badge color="orange" radius="small" size="1">Public key reveal</Badge>
            }
            {
              (metadata.kind == 'message' || metadata.kind == 'transaction') &&
              <Badge color="red" radius="small" size="1">{ metadata.decodedTransaction ? 'Transaction' : 'Message' } signature</Badge>
            }
          </Flex>
          {
            entity.about.description &&
            <Flex gap="2" wrap="wrap" mb="2" ml="2">
              <Text size="2">—— Reason:</Text>
              <Text size="2" color="gray">{ entity.about.description }</Text>
            </Flex>
          }
          <AlertDialog.Description mt="4">
            {
              metadata.kind == 'account' &&
              <>The <Badge color="bronze" size="1">{ entity.proof.hostname }</Badge> app asks you to see reveal your account address. Proceed?</>
            }
            {
              metadata.kind == 'identity' &&
              <>The <Badge color="bronze" size="1">{ entity.proof.hostname }</Badge> app asks you to sign a message to confirm you own this account address. Proceed?</>
            }
            {
              metadata.kind == 'message' &&
              <>The <Badge color="bronze" size="1">{ entity.proof.hostname }</Badge> app asks you to sign a message without knowing its content which may be used to impersonate your account. Proceed with caution.</>
            }
            {
              metadata.kind == 'transaction' &&
              <>The <Badge color="bronze" size="1">{ entity.proof.hostname }</Badge> app asks you to sign and send a transaction that may have unintended side effects allowing one to perform action(s) on your behalf. Proceed with caution.</>
            }
          </AlertDialog.Description>
          {
            metadata.encodedMessage &&
            <>
              <Separator my="3" size="4" />
              <Flex mt="4" align="center" gap="2">
                <Text size="2">Message to sign: </Text>
                <Button size="2" variant="ghost" radius="small" color="indigo" style={{ padding: '0 0.25rem' }} onClick={() => {
                  navigator.clipboard.writeText(metadata.encodedMessage || '');
                  AlertBox.open(AlertType.Info, 'Message copied!')
                }}>{ Readability.toAddress(metadata.encodedMessage) }</Button>
              </Flex>
            </>
          }
          <Flex gap="4" mt="6" justify="center">
            <AlertDialog.Action>
              <Button variant="surface" color="red" onClick={() => resolve(true)}>Approve</Button>
            </AlertDialog.Action>
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray" onClick={() => resolve(false)}>Reject</Button>
            </AlertDialog.Cancel>
          </Flex>
        </AlertDialog.Content>
      }
    </AlertDialog.Root>
  );
}