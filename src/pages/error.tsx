import { mdiListStatus } from "@mdi/js";
import { Box, Callout, Flex, Heading, Text } from "@radix-ui/themes";
import Icon from "@mdi/react";

export default function HypePage() {
  return (
    <Box px="4" pt="6" maxWidth="800px" mx="auto">
      <Flex align="center" mb="3" gap="2">
        <Heading>Not a commonly known place</Heading>
      </Flex>
      <Callout.Root color="yellow">
        <Callout.Icon>
          <Icon path={mdiListStatus} size={1} />
        </Callout.Icon>
        <Callout.Text>
          <Flex direction="column" gap="2">
            <Text>1. You've got a typo in the URL.</Text>
            <Text>2. Or this place became non-existent.</Text>
            <Text>3. Or it didn't exist in the first place.</Text>
          </Flex>
        </Callout.Text>
      </Callout.Root>
    </Box>
  );
}