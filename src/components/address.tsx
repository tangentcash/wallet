import { mdiClose, mdiQrcodeScan, mdiTagOutline } from "@mdi/js";
import { AspectRatio, Badge, Box, Flex, IconButton, Select, Text, TextField } from "@radix-ui/themes";
import { Readability } from "tangentsdk";
import { useMemo, useState } from "react";
import { AlertBox, AlertType } from "./alert";
import { AssetImage } from "./asset";
import Icon from "@mdi/react";
import QRCode from "react-qr-code";

function toAddressType(type: string): string {
  switch (type) {
    case 'routing':
      return 'Deposit sender / receiver';
    case 'bridge':
      return 'Deposit receiver';
    case 'witness':
      return 'Archive address';
    default:
      return 'Tangent address';
  }
}

export function AddressView(props: { address: any, onExit?: () => any }) {
  const mobile = document.body.clientWidth < 500;
  const [variant, setVariant] = useState<number>(0);
  const target = useMemo((): { address: string, tag: string | null } => {
    return variant >= 0 && variant < props.address.addresses.length ? props.address.addresses[variant] : props.address.addresses[0];
  }, [props.address, variant]);
  return (
    <Box>
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
        <AssetImage asset={props.address.asset} size="1"></AssetImage>
        <Badge size="2" color={props.address.purpose != 'witness' ? 'yellow' : 'red'} style={{ textTransform: 'uppercase' }}>{ toAddressType(props.address.purpose) }</Badge>
        { props.address.purpose != 'bridge' && <Badge size="2" color="lime" style={{ textTransform: 'uppercase' }}>Your wallet</Badge> }
        { props.address.purpose == 'bridge' && <Badge size="2" color="blue" style={{ textTransform: 'uppercase' }}>Bridge wallet</Badge> }
      </Flex>
      <Box mt="6">
        <Flex gap="1">
          <TextField.Root size="3" style={{ width: '100%' }} readOnly={true} value={ Readability.toAddress(target.address, mobile ? 6 : 12) } onClick={() => {
              navigator.clipboard.writeText(target.address);
              AlertBox.open(AlertType.Info, 'Address v' + (props.address.addresses.length - variant) + ' copied!')
            }}>
            <TextField.Slot>
              <Icon path={mdiQrcodeScan} size={0.7} style={{ paddingLeft: '4px' }} />
            </TextField.Slot>
          </TextField.Root>
          <Flex gap="1">
            <Select.Root size="3" value={variant.toString()} onValueChange={(value) => setVariant(parseInt(value))}>
              <Select.Trigger>v{ props.address.addresses.length - variant }</Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Label>Select variant</Select.Label>
                  {
                    props.address.addresses.map((address: any, index: number) =>
                      <Select.Item value={index.toString()} key={address.address + '_address'}>
                        <Flex align="center" gap="1">
                          <Text>Variant {props.address.addresses.length - index}</Text>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
            {
              props.onExit &&
              <IconButton variant="soft" size="3" color="gray" onClick={() => {
                setVariant(-1);
                if (props.onExit)
                  props.onExit();
              }}>
                <Icon path={mdiClose} size={1}></Icon>
              </IconButton>
            }
          </Flex>
        </Flex>
        {
          target.tag != null &&
          <Box>
            <TextField.Root mt="3" size="3" readOnly={true} value={ 'DT/M: ' + target.tag } onClick={() => {
                navigator.clipboard.writeText(target.tag as any);
                AlertBox.open(AlertType.Info, 'Dest. tag / memo copied!')
              }}>
              <TextField.Slot>
                <Icon path={mdiTagOutline} size={0.7} style={{ paddingLeft: '4px' }} />
              </TextField.Slot>
            </TextField.Root>
          </Box>
        }
      </Box>
    </Box>
  )
}