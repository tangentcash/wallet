# Payment Page

The Pay screen composes and signs every transaction the network understands. The four tabs — **Transfer**, **Approve**, **Assert** and **Setup** — cover the transaction types; vault deposit and withdrawal forms reuse the same screen with their own layout.

## Common Controls

### Paying Asset

The **From** selector picks the asset the transaction is paid from. This choice also decides which native token is used to cover the network fee, so it must be an asset whose chain can pay gas.

![Paying asset selection](./../assets/09-payments/2.png)

The default Transfer form sends to one account:

![Transfer form](./../assets/09-payments/1.png)

### Advanced Mode (PRO)

The PRO toggle in the header switches the composer to advanced mode: custom **account nonce**, custom **gas price**, custom **gas limit** and a live **fee estimate**. Leaving fields on `Auto` lets the app estimate them at review time based on current network conditions.

![Advanced mode](./../assets/09-payments/10.png)

The `Auto` button on the fee opens a percentile menu — from `Fastest` (>95%) down to `Slowest` (>10%): higher percentiles mean faster inclusion, but a higher price.

![Auto fee percentiles](./../assets/09-payments/11.png)

### Review and Sign

**Review action** validates and simulates the transaction first: the confirmation dialog summarizes the resulting balance changes, events and the final fee, and offers a dump of the finalized transaction payload to the clipboard. Confirming prompts for the wallet password, signs locally and broadcasts to the P2P network. Locked or watch-only wallets stop at a clear warning instead.

# Transfer Function

The Transfer tab sends tokens to one or more accounts in a single transaction.

### Transfer Window Fields

- **Account** — the recipient address. Double-check it: the address decides where the tokens go.
- **Value** — the amount of the selected asset to send. Quick chips set `25%`, `50%` or `Remaining` — the latter fills the field with whatever balance is left after the other recipients and the fee, leaving nothing behind.

![Single recipient](./../assets/09-payments/1.png)

### Multiple Recipients

The `+` button appends another recipient block; `-` removes it. Every recipient gets its own address and value fields, and the `Remaining` chip accounts for the amounts already allocated to the others, so batch payouts of an exact total are a single transaction.

![Multiple recipients](./../assets/09-payments/4.png)

### Tips

- Verify every address before reviewing; transactions cannot be reversed.
- Use `Remaining` deliberately — it drains the balance, including what you might want for future fees.
- Plan multi-recipient distributions before submitting; one transaction is cheaper and atomic.

# Approve Function

The Approve tab signs a **pre-built transaction file** — created externally or exported earlier — instead of composing one from scratch.

Press **Browse** and select the file; both binary and hex transaction payloads are accepted. The paying asset from the file is replaced with the asset selected in the **From** window, so the approval always aligns with the balances you actually hold. A read-only preview of the transaction appears below the form, showing exactly what will be signed.

![Approve tab](./../assets/09-payments/3.png)

On **Review action** the app simulates the transaction: the view updates with the simulation results — executed events and derived fields — before anything is signed, so the final summary reflects the real outcome.

### Tips

- Only approve files you trust, from sources you control.
- Check the preview and the simulation events carefully — you are signing raw intent.

# Assert Function

The Assert tab contests a vault withdrawal whose off-chain payout never arrived. It has a single window with two fields:

- **Relay vault transfer transaction hash** — the hash of the vault's relay (broadcast) transaction that was supposed to pay you out.
- **Vault transfer transaction hash** — the hash of the original vault transfer being asserted.

Submitting the assert transaction after the withdrawal time-lock has passed refunds the full amount back to your Tangent account. Filing it earlier is rejected, and a wrong hash contests the wrong withdrawal — copy both hashes from the transaction history rather than typing them.

![Assert tab](./../assets/09-payments/5.png)

# Setup Function

The Setup tab configures the account's role in network consensus. Every control defaults to *unchanged*, so a setup transaction only alters what you explicitly touch.

![Setup tab](./../assets/09-payments/6.png)

### Block Production

Choose between `ENABLE` and `DISABLE` block production for this account; enabling adds a **production stake** field — the TAN staked to qualify for producer duties and rewards.

![Block production dropdown](./../assets/09-payments/8.png)

![Block production enabled](./../assets/09-payments/7.png)

### Vault Participation

The same pattern for bridge committee membership: enable it and specify the **allocation** (with a `Full` shortcut to stake the whole balance).

![Vault participation](./../assets/09-payments/9.png)

### Vault Attestation

The *Change vault attestation stake* dropdown lists blockchains; selecting one adds an attestation subwindow where you set the attestation stake (and optional fee parameters) for attesting that chain's vault operations, or unlock a previous attestation to release the stake with its rewards.

### Allocate a Vault

*Allocate a vault* creates a new vault for a chosen blockchain: set the **security level** — the number of participants required to run the vault — and the withdrawal **fee rate** in the chain's native token. The subwindow can be cancelled before review.

### Migrate Vault Participant

When a vault's relay transaction failed because of a specific participant, this button adds a migration subwindow: enter the **failed transaction hash** and the **participant to replace**; the migration swaps the faulty member out so the vault can continue.

### Tips

- Stakes lock funds: size block production, participation and attestation stakes deliberately — higher stakes earn more but stay locked.
- Review security levels and fees before allocating a vault; they define the vault's trust profile.
- Keep records of failed relay transactions so migrations and asserts can reference them immediately.
