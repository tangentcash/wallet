import { Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { AppData } from "../core/app";
import { mdiDownload, mdiEmail } from "@mdi/js";
import { CSSProperties } from "react";
import { Link } from "react-router";
import Icon from "@mdi/react";
import { AlertBox, AlertType } from "./alert";

export default function License(props: { style?: CSSProperties, app?: boolean, title?: boolean, size?: number }) {
  const size = props.size || 38;
  const glyph = size < 34 ? 0.9 : 0.975;
  return (
    <Box style={props.style}>
      {
        props.title &&
        <Flex justify="center" mb="6">
          <Text size="2" style={{ color: 'var(--gray-11)' }}>Partners & Contacts</Text>
        </Flex>
      }
      <Flex align="center" justify="center" wrap="wrap" px="4" style={{ gap: 14 }}>
        {
          props.app &&
          <Link to="/app">
            <IconButton variant="solid" size="3" style={{ width: size + 'px', height: size + 'px' }}>
              <Icon path={mdiDownload} size={glyph}></Icon>
            </IconButton>
          </Link>
        }
        <a href="mailto:devs@tangent.cash">
          <IconButton variant="solid" color="indigo" size="3" style={{ width: size + 'px', height: size + 'px' }} onClick={() => {
            navigator.clipboard.writeText('devs@tangent.cash');
            AlertBox.open(AlertType.Info, 'E-mail address copied!')
          }}>
            <Icon path={mdiEmail} size={glyph}></Icon>
          </IconButton>
        </a>
        <a href="https://discord.gg/tangentcash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/discord.svg" width={size} height={size} />
          </IconButton>
        </a>
        <a href="https://github.com/tangentcash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src={AppData.props.appearance == 'dark' ? '/social/githubd.svg' : '/social/githubl.svg' } width={size} height={size} />
          </IconButton>
        </a>
        <a href="https://x.com/TangentCash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/x.svg" width={size} height={size} />
          </IconButton>
        </a>
        <a href="https://blockspot.io/coin/tangent-tan/" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/blockspot.svg" width={size} height={size} />
          </IconButton>
        </a>
        <a href="https://coinsniper.net/coin/93075" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/coinsniper.svg" width={size} height={size} />
          </IconButton>
        </a>
      </Flex>
      <Flex justify="center" mt="7">
        <Text size="2" style={{ color: 'var(--gray-11)' }}>Tangent Cash { new Date().getFullYear() } / MIT License</Text>
      </Flex>
    </Box>
  )
}
