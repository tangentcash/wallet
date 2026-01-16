import { Navigate, useParams } from "react-router";
import { Badge, Box, Flex, Heading } from "@radix-ui/themes";
import { AppData } from "../core/app";
import Account from "../components/account";

export default function AccountPage() {
  const baseAddress = useParams().id || '';
  const ownerAddress = AppData.getWalletAddress() || '';
  if (ownerAddress == baseAddress || !baseAddress.length)
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Flex align="center" gap="2" px="2">
        <Heading size="6">Account</Heading>
        <Badge variant="surface" color="blue" size="2">{ baseAddress.substring(baseAddress.length - 6) }</Badge>
      </Flex>
      <Account ownerAddress={baseAddress}></Account>
    </Box>
  );
}