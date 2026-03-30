import { Box, Heading, Separator, Table, Tabs, Text } from "@radix-ui/themes";
import { useState } from "react";

export default function LegalPage() {
  const [state, setState] = useState<'terms-of-use' | 'privacy-policy'>('terms-of-use');
  return (
    <Box px="2" pt="4" maxWidth="680px" mx="auto">
      <Tabs.Root  value={state} onValueChange={(e) => setState(e as any)}>
        <Tabs.List size="2">
          <Tabs.Trigger value="terms-of-use">
            <Heading size="3">Terms of Use</Heading>
          </Tabs.Trigger>
          <Tabs.Trigger value="privacy-policy">
            <Heading size="3">Privacy Policy</Heading>
          </Tabs.Trigger>
        </Tabs.List>
        <Box pt="5">
          <Tabs.Content value="terms-of-use">
            <Heading>Tangent Cash Terms of Use</Heading>
            <Text size="1">Effective Date: 15.08.2025</Text>
            <Box my="6">
              <Text>Welcome to Tangent Cash! These Terms of Use ("Terms") govern your access to and use of the Tangent Cash App software and any related services provided by Tangent Cash through our website at https://tangent.cash or mobile application. By accessing or using any part of the Tangent Cash services, you agree to be bound by these Terms.</Text> 
            </Box>
            <Heading size="4">1. Acceptance of Terms</Heading>
            <Box my="4">
              <Text>These Terms constitute a legally binding agreement between you and Tangent Cash. If you do not agree to these Terms, please do not access or use the Tangent Cash services.</Text> 
            </Box>
            <Heading size="4">2. Description of Services</Heading>
            <Box my="4">
              <Text>Tangent Cash App service provides a decentralized wallet (Tangent Wallet) and a decentralized exchange (Tangent Exchange) that allow users to manage their cryptocurrency assets and trade them directly on the blockchain. Additionally, Tangent Cash offers bridging functionality that enables users to transfer assets, such as Bitcoin, onto the Tangent blockchain and vice versa. The services are available both online through our website and offline through our mobile application.</Text> 
            </Box>
            <Heading size="4">3. User Responsibilities</Heading>
            <Heading size="4" mt="2">3.1 Private Keys and Security</Heading>
            <Box my="4">
              <Text>You are solely responsible for managing your private keys and ensuring the security of your Tangent Wallet. Tangent Cash will not have access to your private keys, and we cannot recover your funds if you lose access to your wallet. Always keep your private keys secure and never share them with anyone.</Text> 
            </Box>
            <Heading size="4" mt="2">3.2 Compliance with Laws</Heading>
            <Box my="4">
              <Text>You are responsible for ensuring that your use of the Tangent Wallet, Tangent Exchange, and bridging functionality complies with all applicable laws and regulations in your jurisdiction. Tangent Cash is a decentralized protocol, and we do not control or endorse any specific use of our services.</Text> 
            </Box>
            <Heading size="4">4. Bridging Functionality</Heading>
            <Box my="4">
              <Text>The bridging functionality allows users to transfer assets between the Tangent blockchain and other blockchains, such as Bitcoin. This process involves locking assets on the source blockchain and minting equivalent assets on the Tangent blockchain. Users are responsible for understanding the risks associated with bridging, including but not limited to:</Text> 
            </Box>
            <Box mt="2">
              <Text><b>Smart Contract Risks: </b>The bridging process relies on smart contracts, which may contain bugs or vulnerabilities.</Text>
            </Box>
            <Box mt="2">
              <Text><b>Liquidity Risks: </b>There may be periods of low liquidity on either side of the bridge, affecting your ability to transfer assets.</Text>
            </Box>
            <Box mt="2">
              <Text><b>Counterparty Risks: </b>The bridging process involves interacting with other blockchains and their respective validators or miners.</Text>
            </Box>
            <Box mt="2" mb="4">
              <Text>Tangent Cash does not guarantee the successful completion of any bridge transaction, and we are not responsible for any losses incurred due to bridging activities.</Text> 
            </Box>
            <Heading size="4">5. Decentralized Nature</Heading>
            <Box my="4">
              <Text>Tangent Cash is a fully decentralized autonomous organization (DAO). We operate on a decentralized network, and no single entity controls the protocol. This means that Tangent Cash does not have the ability to freeze, seize, or otherwise control your funds.</Text> 
            </Box>
            <Heading size="4">6. Disclaimers</Heading>
            <Heading size="4" mt="2">6.1 No Warranty</Heading>
            <Box my="4">
              <Text>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TANGENT CASH MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO, WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.</Text> 
            </Box>
            <Heading size="4" mt="2">6.2 No Liability</Heading>
            <Box my="4">
              <Text>TANGENT CASH SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</Text> 
            </Box>
            <Heading size="4" mt="6">7. Changes to This Terms of Use Policy</Heading>
            <Box my="4">
              <Text>We may update this Terms of Use Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this Terms of Use Policy periodically to stay informed.</Text> 
            </Box>
            <Heading size="4">8. Contact Information</Heading>
            <Box my="4">
              <Text>If you have any questions or concerns about these Terms or the Tangent Cash services, please contact us at devs@tangent.cash by e-mail.</Text> 
            </Box>
            <Box>
              <Separator my="6" size="4"></Separator>
            </Box>
            <Box>
              <Text>By using Tangent Cash (https://tangent.cash), you acknowledge that you have read and understood this Terms of Use Policy and agree to its terms. Thank you for choosing our website!</Text>
            </Box>
          </Tabs.Content>
          <Tabs.Content value="privacy-policy">
            <Heading>Tangent Cash Privacy Policy</Heading>
            <Text size="1">Effective Date: 15.08.2025</Text>
            <Box my="6">
              <Text>Welcome to Tangent Cash (https://tangent.cash). We are committed to protecting your privacy and ensuring the security of any information you provide while using our website. This Privacy Policy explains how we handle the minimal amount of data necessary for the operation of our site, given that we do not store any personal information.</Text> 
            </Box>
            <Heading size="4">1. Information Collection and Use</Heading>
            <Heading size="4" mt="2">1.1 Types of Data Collected</Heading>
            <Box my="4">
              <Text>We do not collect or store any personal identifiable information (PII) from users who visit our website. This means we do not gather data such as names, email addresses, physical addresses, or any other personally identifiable details.</Text> 
            </Box>
            <Heading size="4">1.2 Non-Personal Information</Heading>
            <Box my="4">
              <Text>While we do not store PII, we may temporarily process non-personal information for the duration of your session on our site. This could include:</Text>
            </Box>
            <Table.Root variant="surface" style={{
                borderRadius: '24px'
              }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Source</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Reason</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                <Table.Row>
                  <Table.RowHeaderCell>IP Addresses</Table.RowHeaderCell>
                  <Table.Cell>Temporary storage to facilitate website functionality and security.</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.RowHeaderCell>Browser Type</Table.RowHeaderCell>
                  <Table.Cell>To ensure compatibility and optimize user experience.</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.RowHeaderCell>Operating System</Table.RowHeaderCell>
                  <Table.Cell>To provide a seamless experience across different platforms.</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.RowHeaderCell>Timestamp</Table.RowHeaderCell>
                  <Table.Cell>To monitor and maintain the security of our site.</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
            <Heading size="4" mt="6">2. Data Security</Heading>
            <Box my="4">
              <Text>We implement industry-standard security measures to protect any non-personal information temporarily processed during your session. These measures include secure server configurations and encrypted data transmission where applicable.</Text> 
            </Box>
            <Heading size="4" mt="6">3. Third-Party Services</Heading>
            <Box my="4">
              <Text>We do not use third-party services that track or collect user data without explicit consent. Any third-party integrations are chosen for their commitment to privacy and lack of data storage capabilities.</Text> 
            </Box>
            <Heading size="4" mt="6">4. User Rights</Heading>
            <Box my="4">
              <Text>Since we do not store any personal information, users do not have rights related to data access, correction, or deletion. However, if you have any concerns or questions, please feel free to contact us.</Text> 
            </Box>
            <Heading size="4" mt="6">5. Changes to This Privacy Policy</Heading>
            <Box my="4">
              <Text>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your privacy.</Text> 
            </Box>
            <Heading size="4" mt="6">6. Contact Information</Heading>
            <Box my="4">
              <Text>If you have any questions or concerns about this Privacy Policy, please contact us at: devs@tangent.cash</Text>
            </Box>
            <Box>
              <Separator my="6" size="4"></Separator>
            </Box>
            <Box>
              <Text>By using Tangent Cash (https://tangent.cash), you acknowledge that you have read and understood this Privacy Policy and agree to its terms. Thank you for choosing our website!</Text>
            </Box>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}