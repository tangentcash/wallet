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
function toAddressVariant(network: string, address: string): string {
  switch (network) {
    case 'SOL':
    case 'XLM':
    case 'XMR':
      return 'P2PK';
    case 'ADA':
    case 'ARB':
    case 'AVAX':
    case 'BASE':
    case 'BLAST':
    case 'BNB':
    case 'CELO':
    case 'ETC':
    case 'ETH':
    case 'GNO':
    case 'MATIC':
    case 'OP':
    case 'S':
    case 'LINEA':
    case 'TRX':
    case 'ZK':
    case 'XRP':
    case 'BCH':
    case 'BSV':
    case 'DASH':
    case 'DOGE':
    case 'XEC':
      return 'P2PKH';
    case 'BTC': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('1')) {
        return 'P2PKH';
      } else if (address.startsWith('3')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'BTG': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } else if (address.startsWith('G')) {
        return 'P2PKH';
      } else if (address.startsWith('A')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'DGB': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('D')) {
        return 'P2PKH';
      } else if (address.startsWith('S')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'LTC': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('3') || address.startsWith('L')) {
        return 'P2PKH';
      } else if (address.startsWith('M')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'ZEC':
      return address.startsWith('t1') ? 'P2PKH' : 'P2UPKH';
    case 'TAN':
      return 'P2PKH';
    default:
      return 'P2A';
  }
}

export function AddressView(props: { address: any, onExit?: () => any }) {
  const mobile = document.body.clientWidth < 500;
  const [variant, setVariant] = useState<number>(0);
  const target = useMemo((): { address: string, tag: string | null } => {
    return variant >= 0 && variant < props.address.addresses.length ? props.address.addresses[variant] : props.address.addresses[0];
  }, [props.address, variant]);
  const variants = useMemo(() => {
    const duplicates: Record<string, number> = { };
    const results = props.address.addresses.map((x: any) => toAddressVariant(props.address.asset.chain, x.address));
    for (let i = 0; i < results.length; i++) {
      const type = results[i];
      if (duplicates[type]) {
        results[i] = type + 'v' + duplicates[type].toString();
        ++duplicates[type];
      } else {
        duplicates[type] = 1;
      }
    }
    return results;
  }, [props.address]);
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
              AlertBox.open(AlertType.Info, variants[variant] + ' address copied!')
            }}>
            <TextField.Slot>
              <Icon path={mdiQrcodeScan} size={0.7} style={{ paddingLeft: '4px' }} />
            </TextField.Slot>
          </TextField.Root>
          <Flex gap="1">
            <Select.Root size="3" value={variant.toString()} onValueChange={(value) => setVariant(parseInt(value))}>
              <Select.Trigger>{ variants[variant] }</Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Label>Select variant</Select.Label>
                  {
                    props.address.addresses.map((address: any, index: number) =>
                      <Select.Item value={index.toString()} key={address.address + '_address'}>
                        <Flex align="center" gap="1">
                          <Text>{ variants[index] }</Text>
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
            <TextField.Root mt="3" size="3" readOnly={true} value={ 'Memo (DT): ' + target.tag } onClick={() => {
                navigator.clipboard.writeText(target.tag as any);
                AlertBox.open(AlertType.Info, 'Memo (destination tag) copied!')
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