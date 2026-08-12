import { Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { AppData } from "../core/app";
import { mdiDownload, mdiEmail } from "@mdi/js";
import { CSSProperties } from "react";
import { Link } from "react-router";
import Icon from "@mdi/react";
import { AlertBox, AlertType } from "./alert";

export default function License(props: { style?: CSSProperties, app?: boolean, title?: boolean }) {
  return (   
    <Box style={props.style}>
      {
        props.title &&
        <Flex justify="center" mb="6">
          <Text size="2" style={{ color: 'var(--gray-11)' }}>Partners & Contacts</Text>
        </Flex>
      }
      <Flex align="center" justify="center" gap="6" wrap="wrap" px="4">
        {
          props.app &&
          <Link to="/app">
            <IconButton variant="solid" size="3" style={{ width: '38px', height: '38px' }}>
              <Icon path={mdiDownload} size={0.975}></Icon>
            </IconButton>
          </Link>
        }
        <a href="https://discord.gg/tangentcash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/discord.svg" width="38px" height="38px" />
          </IconButton>
        </a>
        <a href="https://github.com/tangentcash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src={AppData.props.appearance == 'dark' ? '/social/githubd.svg' : '/social/githubl.svg' } width="38px" height="38px" />
          </IconButton>
        </a>
        <a href="https://x.com/TangentCash" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/x.svg" width="38px" height="38px" />
          </IconButton>
        </a>
        <a href="mailto:devs@tangent.cash">
          <IconButton variant="solid" color="indigo" size="3" style={{ width: '38px', height: '38px' }} onClick={() => {
            navigator.clipboard.writeText('devs@tangent.cash');
            AlertBox.open(AlertType.Info, 'E-mail address copied!')
          }}>
            <Icon path={mdiEmail} size={0.975}></Icon>
          </IconButton>
        </a>
        <a href="https://blockspot.io/coin/tangent-tan/" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/blockspot.svg" width="38px" height="38px" />
          </IconButton>
        </a>
        <a href="https://coinsniper.net/coin/93075" target="_blank">
          <IconButton variant="ghost" color="gray" size="2">
            <img src="/social/coinsniper.svg" width="38px" height="38px" />
          </IconButton>
        </a>
      </Flex>
      <Flex justify="center" mt="7">
        <Text size="2" style={{ color: 'var(--accent-11)' }}>Tangent Cash { new Date().getFullYear() } / MIT License</Text>
      </Flex>
    </Box>
  )
}