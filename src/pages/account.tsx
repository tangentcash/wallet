import { Navigate, useNavigate, useParams } from "react-router";
import { Wallet } from "../core/wallet";
import { Box, Button, Flex, Heading } from "@radix-ui/themes";
import { mdiBackburger } from "@mdi/js";
import Account from "../components/account";
import Icon from "@mdi/react";

export default function AccountPage() {
  const id = useParams().id || '';
  const ownerAddress = Wallet.getAddress() || '';
  const navigate = useNavigate();
  if (ownerAddress == id || !id)
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Flex justify="between" align="center">
        <Heading size="6">Account</Heading>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Account ownerAddress={id}></Account>
    </Box>
  );
}