import { Navigate, useNavigate, useParams } from "react-router";
import { Badge, Box, Button, Flex, Heading } from "@radix-ui/themes";
import { mdiBackburger } from "@mdi/js";
import { AppData } from "../core/app";
import Account from "../components/account";
import Icon from "@mdi/react";

export default function AccountPage() {
  const id = useParams().id || '';
  const ownerAddress = AppData.getWalletAddress() || '';
  const navigate = useNavigate();
  if (ownerAddress == id || !id)
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Flex justify="between" align="center">
        <Flex align="center" gap="2">
          <Heading size="6">Account</Heading>
          <Badge radius="medium" variant="surface" color="blue" size="2">{ id.substring(id.length - 6).toUpperCase() }</Badge>
        </Flex>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Account ownerAddress={id}></Account>
    </Box>
  );
}