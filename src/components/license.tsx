import { Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { AppData } from "../core/app";
import { mdiDownload, mdiEmail } from "@mdi/js";
import { CSSProperties } from "react";
import Icon from "@mdi/react";
import { Link } from "react-router";

export default function License(props: { style?: CSSProperties, app?: boolean }) {
  return (   
    <Box style={props.style}>
      <Flex align="center" justify="center" gap="6">
        <a href="https://discord.gg/TyubmucCTB" target="_blank">
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
          <IconButton variant="solid" color="indigo" size="3" style={{ width: '38px', height: '38px' }}>
            <Icon path={mdiEmail} size={0.975}></Icon>
          </IconButton>
        </a>
        {
          props.app &&
          <Link to="/app">
            <IconButton variant="solid" color="lime" size="3" style={{ width: '38px', height: '38px' }}>
              <Icon path={mdiDownload} size={0.975}></Icon>
            </IconButton>
          </Link>
        }
      </Flex>
      <Flex justify="center" mt="7">
        <Text size="2" color="lime">Tangent Cash { new Date().getFullYear() } / MIT License</Text>
      </Flex>
    </Box>
  )
}