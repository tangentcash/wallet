import { Navigate, useNavigate, useParams } from "react-router";
import { Badge, Box, Button, Flex, Heading } from "@radix-ui/themes";
import { AppData } from "../core/app";
import { mdiMagnifyScan } from "@mdi/js";
import Account from "../components/account";
import Icon from "@mdi/react";

export default function AccountPage() {
  const baseAddress = useParams().id || '';
  const ownerAddress = AppData.getWalletAddress() || '';
  const navigate = useNavigate();
  if (ownerAddress == baseAddress || !baseAddress.length)
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;

  return (
    <Box pt="4" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="4" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '5' : '6'}>Account</Heading>
          <Badge variant="surface" color="blue" size="2">{ baseAddress.substring(baseAddress.length - 6) }</Badge>
        </Flex>
        <Flex justify="end" gap="1">
          <Button variant="soft" size="2" color="gray" onClick={() => navigate('/explorer')}>
            <Icon path={mdiMagnifyScan} size={0.9} />
          </Button>
        </Flex>
      </Flex>
      <Account ownerAddress={baseAddress}></Account>
    </Box>
  );
}