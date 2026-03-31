import { mdiClose, mdiInformationOutline, mdiKeyOutline, mdiQrcodeScan, mdiTagOutline } from "@mdi/js";
import { AspectRatio, Badge, Box, Callout, Flex, IconButton, Select, Text, TextField } from "@radix-ui/themes";
import { Readability } from "tangentsdk";
import { useMemo, useState } from "react";
import { AlertBox, AlertType } from "./alert";
import Icon from "@mdi/react";
import QRCode from "react-qr-code";

function toAddressType(type: string): string {
  switch (type) {
    case 'routing':
      return 'Deposit sender / withdrawal receiver';
    case 'bridge':
      return 'Deposit receiver';
    case 'witness':
      return 'Archive';
    default:
      return 'Tangent wallet';
  }
}
function toAddressPurpose(address: any) {
  if (!address || !address.purpose)
    return <>Tangent wallet → on-chain account.</>;
  else if (address.purpose == 'routing')
    return <>Routing wallet → token reedemer.</>;
  else if (address.purpose == 'bridge')
    return <>Bridge wallet → token minter.</>;
  return <>Witness wallet → discarded.</>;
}

export function AddressView(props: { address: any, onExit?: () => any }) {
  const mobile = document.body.clientWidth < 500;
  const [version, setVersion] = useState<number>(0);
  const target = useMemo((): { address: string, tag: string | null } => {
    return version >= 0 && version < props.address.addresses.length ? props.address.addresses[version] : props.address.addresses[0];
  }, [props.address, version]);
  return (
    <Box px="2" py="2">
      <Flex justify="center" mb="4">
        <Callout.Root size="1">
          <Callout.Icon>
            <Icon path={mdiInformationOutline} size={1} />
          </Callout.Icon>
          <Callout.Text wrap="balance" style={{ wordBreak: 'break-word' }}>
            { toAddressPurpose(props.address) } 
          </Callout.Text>
        </Callout.Root>
      </Flex>
      <Flex justify="center" width="100%">
        <Box width="80%" maxWidth="280px" px="3" py="3" style={{ borderRadius: '16px', backgroundColor: target.address ? 'white' : 'var(--color-panel)' }}>
          <AspectRatio ratio={1}>
            {
              target.address &&
              <QRCode value={ target.address } style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
            }
          </AspectRatio>
        </Box>
      </Flex>
      <Flex align="center" justify="center" mt="3" gap="2">
        <Badge size="2" color={props.address.purpose != 'witness' ? 'lime' : 'red'} style={{ textTransform: 'uppercase' }}>{ toAddressType(props.address.purpose) }</Badge>
        { props.address.purpose != 'bridge' && <Badge size="2" color="red" style={{ textTransform: 'uppercase' }}>Your wallet</Badge> }
      </Flex>
      <Box mt="6">
        <Flex gap="2">
          <TextField.Root size="3" style={{ width: '100%' }} variant="soft" readOnly={true} value={ Readability.toAddress(target.address, mobile ? 6 : 12) } onClick={() => {
              navigator.clipboard.writeText(target.address);
              AlertBox.open(AlertType.Info, 'Address v' + (props.address.addresses.length - version) + ' copied!')
            }}>
            <TextField.Slot color="gray">
              <Icon path={mdiKeyOutline} size={0.7} style={{ paddingLeft: '4px' }} />
            </TextField.Slot>
          </TextField.Root>
          {
            props.onExit &&
            <IconButton variant="soft" size="3" color="red" onClick={() => {
              setVersion(-1);
              if (props.onExit)
                props.onExit();
            }}>
              <Icon path={mdiClose} size={1}></Icon>
            </IconButton>
          }
        </Flex>
        {
          target.tag != null &&
          <TextField.Root mt="3" size="3" color="red" variant="soft" readOnly={true} value={ 'Dest. tag (memo) #' + target.tag } onClick={() => {
              navigator.clipboard.writeText(target.tag as any);
              AlertBox.open(AlertType.Info, 'Dest. tag / memo copied!')
            }}>
            <TextField.Slot color="red">
              <Icon path={mdiTagOutline} size={0.7} style={{ paddingLeft: '4px' }} />
            </TextField.Slot>
          </TextField.Root>
        }
        <Box width="100%" mt="3">
          <Select.Root size="3" value={version.toString()} onValueChange={(value) => setVersion(parseInt(value))}>
            <Select.Trigger variant="soft" color="gray" style={{ width: '100%' }}>
              <Flex as="span" align="center" gap="2">
                <Icon path={mdiQrcodeScan} size={0.7} style={{ color: 'var(--gray-11)' }} />
                <Text color="gray">{ Readability.toAssetName(props.address.asset) } address v{ props.address.addresses.length - version }</Text>
              </Flex>
            </Select.Trigger>
            <Select.Content variant="soft">
              <Select.Group>
                <Select.Label>Address version</Select.Label>
                {
                  props.address.addresses.map((address: any, index: number) =>
                    <Select.Item value={index.toString()} key={address.address + '_address'}>
                      <Flex align="center" gap="1">
                        <Text>Version {props.address.addresses.length - index}</Text>
                      </Flex>
                    </Select.Item>
                  )
                }
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Box>
      </Box>
    </Box>
  )
}