import { useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { Box, Button, Callout, Card, Flex, Heading, IconButton, Spinner, Text } from "@radix-ui/themes";
import { mdiContentCopy, mdiListStatus, mdiProgressQuestion } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { RPC, Readability } from "tangentsdk";
import { CodeBlock } from 'react-code-block';
import Icon from "@mdi/react";

export default function ProgramPage() {
  const params = useParams();
  const [program, setProgram] = useState<{ hashcode: string, storage: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffectAsync(async () => {
    try {
      const id = params.id;
      if (!id)
        throw false;
      
      const result = await RPC.getWitnessProgram(id);
      if (!result)
        throw false;

      setProgram(result);
    } catch {
      setProgram(null);
    }
    setLoading(false);
  }, [params]);

  if (program != null) {
    return (
      <Box px="4" pt="4" maxWidth="1400px" mx="auto">
        <Flex justify="between" align="center">
          <Heading size="6">Program code</Heading>
          <Flex align="center" gap="2">
            <IconButton size="3" variant="soft" color="indigo" onClick={() => {
              navigator.clipboard.writeText(program.storage);
              AlertBox.open(AlertType.Info, 'Program storage copied!')
            }}>
              <Icon path={mdiContentCopy} size={1}></Icon>
            </IconButton>
            <Button size="3" variant="soft" color="indigo" onClick={() => {
              navigator.clipboard.writeText(program.hashcode);
              AlertBox.open(AlertType.Info, 'Program hashcode copied!')
            }}>{ Readability.toHash(program.hashcode, 5) }</Button>
          </Flex>
        </Flex>
        <Card variant="surface" mt="2">
          <CodeBlock code={program.storage} language="cpp">
            <CodeBlock.Code style={{ overflowX: 'auto', marginTop: 0 }}>
              <Flex gap="7">
                <CodeBlock.LineNumber style={{ color: 'var(--gray-10)' }} />
                <CodeBlock.LineContent>
                  <CodeBlock.Token />
                </CodeBlock.LineContent>
              </Flex>
            </CodeBlock.Code>
          </CodeBlock>
        </Card>
      </Box>
    )
  } else if (loading) {
    return (
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  } else {
    return (
      <Box px="4" pt="6" maxWidth="800px" mx="auto">
        <Flex align="center" mb="3" gap="2">
          <Icon path={mdiProgressQuestion} size={1.1} />
          <Heading>Program not found</Heading>
        </Flex>
        <Callout.Root color="yellow">
          <Callout.Icon>
            <Icon path={mdiListStatus} size={1} />
          </Callout.Icon>
          <Callout.Text>
            <Flex direction="column" gap="2">
              <Text>1. The contract hashcode may be incorrectly formatted or contain typos in the hexadecimal string.</Text>
              <Text>2. The contract might not have been successfully deployed or was deployed to a different hashcode than expected.</Text>
              <Text>3. The node may not have indexed or synchronized the contract data yet.</Text>
            </Flex>
          </Callout.Text>
        </Callout.Root>
      </Box>
    )
  }
}