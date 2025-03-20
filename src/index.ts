import algosdk from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SMART_CONTRACT_ARC_32 } from "./client";

// The app ID to interact with.
const appId = 736014374;

// Replace with your account mnemonic
const mnemonic = "verify tribe vessel mystery broom market naive share sick position cherry scheme guess convince grocery spirit category cube pony mesh volcano craft dose abandon cheese";
const account = algosdk.mnemonicToSecretKey(mnemonic);

async function loadClients() {
  const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
  const indexerClient = new algosdk.Indexer("", "https://testnet-idx.algonode.cloud", "");
  return { algodClient, indexerClient };
}

async function getGlobalState(indexerClient: algosdk.Indexer, appId: number) {
  const appInfo = await indexerClient.lookupApplications(appId).do();
  const globalState = appInfo.application.params["global-state"];
  const decodedState = globalState.reduce((acc: any, item: any) => {
    const key = Buffer.from(item.key, "base64").toString();
    const value = item.value.uint || item.value.bytes;
    acc[key] = value;
    return acc;
  }, {});
  return decodedState;
}

async function claimAsset() {
  const { algodClient, indexerClient } = await loadClients();
  const sender = account.addr;

  // Fetch the global state of the application
  const globalState = await getGlobalState(indexerClient, appId);
  const assetId = globalState.asset;

  // Ensure the account is opted into the ASA
  const accountInfo = await algodClient.accountInformation(sender).do();
  const optedIn = accountInfo.assets.some((asset) => asset["asset-id"] === assetId);

  if (!optedIn) {
    console.log(`Opting into ASA with ID: ${assetId}`);
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: sender,
      to: sender,
      assetIndex: assetId,
      amount: 0,
      suggestedParams: await algodClient.getTransactionParams().do(),
    });

    const signedOptInTxn = optInTxn.signTxn(account.sk);
    await algodClient.sendRawTransaction(signedOptInTxn).do();
    console.log("Opt-in transaction sent.");
  }

  // Call the claimAsset method
  console.log("Calling claimAsset method...");
  const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: sender,
    appIndex: appId,
    appArgs: [algosdk.encodeUint64(SMART_CONTRACT_ARC_32.contract.methods.find((m) => m.name === "claimAsset").name)],
    suggestedParams: {
      ...(await algodClient.getTransactionParams().do()),
      fee: 6000,
    },
  });

  const signedAppCallTxn = appCallTxn.signTxn(account.sk);
  await algodClient.sendRawTransaction(signedAppCallTxn).do();
  console.log("claimAsset transaction sent.");
}

claimAsset().catch((err) => console.error("Error claiming asset:", err));
