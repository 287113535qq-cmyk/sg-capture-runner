// SG wire adapter for the complete AG program. No legacy SG processor imports.
// AG still owns the round loop, feature counters, scheduler, quota and Mongo I/O.
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { AGGameConfig } from './ag.types';
import { AGDiscardedRoundError } from './ag.round';

// Own NOVA protocol DATA only. The original AG loop still owns every request.

export type OwnNOVAFeatureRequest = {event:string;parameters:Record<string,string>};
export type OwnNOVAFeatureProfile = {
 gameId:string;dbName:string;runtimeGameId:number;runtimeSlug:string;ownSDKFileSHA256:string;
 cfg:number;ftvKey:string;kind:'rhino-wheel'|'wild-grid'|'drums-two-round-cards'|'squid-bridge'|'quickhit-single-round-pick'|'linked-one-pick';
 additionalModes?:number[];
 endNextV3?:boolean;
 endMode4V4?:boolean;
 tugOfWarV4?:boolean;
};
const profiles:Record<string,OwnNOVAFeatureProfile>={
 '32733':{gameId:'32733',dbName:'sg_ragingrhinorampagecap250c96',runtimeGameId:33133,runtimeSlug:'ragingrhinorampagecap250c96',ownSDKFileSHA256:'1f7b2b35f03e6aaba2552e6ff465725342feae927301f9987963d1e1460107c2',cfg:0,ftvKey:'FTV_0',kind:'rhino-wheel'},
 '32666':{gameId:'32666',dbName:'sg_thewildthree',runtimeGameId:33090,runtimeSlug:'thewildthree',ownSDKFileSHA256:'f7778c05e93e67ea364ab62727449f8909032dbaf20853073dad905db5e846ef',cfg:2,ftvKey:'FTV_2',kind:'wild-grid'},
};
const expectedBindings:Record<string,any>={"32666":{"version":"own-NOVA-source-feature-next-v88","paidNormalFGTFirst":true,"ongoingFreeNFGFirst":true,"CFGValidatedOnlyWhenOwnFeatureBranchActuallySelected":true,"entrySelectorsUseActualFTVAndActualOrSourceRetainedCFG":true,"noSynthesizedNFGFromIFGT":true,"startEvent":"FEATURE_START","pickEvent":"FEATURE_PICK","endEvent":"FEATURE_END","requestFieldsFromOwnSourceOnly":true,"sourceAbsentSelectorDoesNotInventValue":true,"originalAGBAndTWMoneyAndSuccessfulEnvelopeRemainRequired":true,"noDisplayTWorCWorFTVPrizeEquationGate":true,"allOriginalRawRequestsResponsesAndUnknownPreserved":true,"oldUnknownPOSTNeverReplayed":true,"boundedOriginalAGFeatureRequestBudgetRequired":true,"summaryNextState":"BASE_IDLE","postFeatureEndNextFromActualResponseNotInvented":true,"ownNaturalFeatureProviderResponsesObserved":0,"gameId":"32666","dbName":"sg_thewildthree","runtimeGameId":33090,"runtimeSlug":"thewildthree","ownSDKFileSHA256":"f7778c05e93e67ea364ab62727449f8909032dbaf20853073dad905db5e846ef","ownCFG":"2","ownEntryFTVKey":"FTV_2","sourceHashes":{"FeatureStartState":"8f992a7f0a6809bc29a07a1f383a0d89c0309d94b2aac25c1e51ace95a2d4f02","FeaturePickState":"a680ea1e1a0657e1e31d18a21e558ebbe261240afab9d360be6784e5397e2a8c","FeatureEndState":"445bc68f10dfdd6ecf1ff54d0d667b5df66d59b43971db71a58ebbb985c48a95","ownPickSelect":"faff8544b348c808dc0d5b373c11308f377e16e51ca5033c9772cefa406a7e9e","FTVFeatureTriggerDecoder":"bb1a4009b3a9d03b8ae00e897f448deecb73a42a2b5178555553c5fb6cde37df","CFGSourceStateDecoder":"4032bacfd673ed1b95e1098fee6b37abe4498e301f52a0da29558ef7f79638b4","ownPostPickMPRDecision":"81eab1b0168ecaf541f987f31ffbf32b3c83f264adca5a974eb76f1b64aee477","ownFeatureIntroCaller":"49f1de2808f28b7087343179f2da6f226f496870258721468b596705dbdda67a","ownFiniteGrid":"81049cee0b54a54e66899abfa9e735d4166552d76db17499c42d4a69a6b79198","ownPickButtonCallback":"990697c082e7dbb65b2b98037bf278b4f390ad964a7977b9ebd0977d14803bdb","ownPickStartReset":"a7c693eda4361fa3622903880e021798f7ad21b2c8357c36f8d29c7d6c041f60","ownButtonAppearance":"da852c1312bbff91adc62d9f33ee9bd779317b43f8ac51b631c46133e59c4a51","ownButtonEnabled":"dbfa0713e342dbe3fcff1b4e254c5bd213a124b0a74e5abab3a69602b2558664","ownButtonConsumed":"f02001b1b5ff8f4e3137107318ff90e5be8bde34a0f3ec524297967504e971d2","ownSummaryExit":"b42ab08976020b4c2f68c689ecefdf042b2348944d8de6955e1c9f3ba7fdb883"},"profile":"own-Wild3-CFG2-fifteen-grid","sourcePickRoundFixed":1,"sourceLocalPickOrdinalInitial":0,"sourceLocalPickOrdinalIncrementBeforeCallback":true,"sourceChoiceInitialIndices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],"sourceChosenIndexDisabledUntilNewOwnFeature":true,"sourceChoicePolicyMustExplicitlySelectOneOwnAvailableIndex":true,"sourceMaxDistinctChoicesPerFeature":15,"postPickSelector":"current-GSD-MPR-parseInt-positive","sourceMPRAbsentOrNaNSelectsFeatureEnd":true,"sourceMPRNotRetainedFromPreviousPacket":true,"summaryLocalEvent":"CLOSE_FEATURE_SUMMARY2","summaryOwnExitCode":1,"ownCAPSEarlyFeatureEndSkip":false,"ownSDKHasCAPSToken":false},"32733":{"version":"own-NOVA-source-feature-next-v88","paidNormalFGTFirst":true,"ongoingFreeNFGFirst":true,"CFGValidatedOnlyWhenOwnFeatureBranchActuallySelected":true,"entrySelectorsUseActualFTVAndActualOrSourceRetainedCFG":true,"noSynthesizedNFGFromIFGT":true,"startEvent":"FEATURE_START","pickEvent":"FEATURE_PICK","endEvent":"FEATURE_END","requestFieldsFromOwnSourceOnly":true,"sourceAbsentSelectorDoesNotInventValue":true,"originalAGBAndTWMoneyAndSuccessfulEnvelopeRemainRequired":true,"noDisplayTWorCWorFTVPrizeEquationGate":true,"allOriginalRawRequestsResponsesAndUnknownPreserved":true,"oldUnknownPOSTNeverReplayed":true,"boundedOriginalAGFeatureRequestBudgetRequired":true,"summaryNextState":"BASE_IDLE","postFeatureEndNextFromActualResponseNotInvented":true,"ownNaturalFeatureProviderResponsesObserved":0,"gameId":"32733","dbName":"sg_ragingrhinorampagecap250c96","runtimeGameId":33133,"runtimeSlug":"ragingrhinorampagecap250c96","ownSDKFileSHA256":"1f7b2b35f03e6aaba2552e6ff465725342feae927301f9987963d1e1460107c2","ownCFG":"0","ownEntryFTVKey":"FTV_0","sourceHashes":{"FeatureStartState":"8f992a7f0a6809bc29a07a1f383a0d89c0309d94b2aac25c1e51ace95a2d4f02","FeaturePickState":"eba4eba6fb2fc9a3b5175da434cf7d71aa17b8c2d402f8bde6b644431f56df20","FeatureEndState":"52f8f776bd2d339f873a789241094133092d0ba603499209dec6566eb826ead4","FTVFeatureTriggerDecoder":"bb1a4009b3a9d03b8ae00e897f448deecb73a42a2b5178555553c5fb6cde37df","CFGSourceStateDecoder":"4032bacfd673ed1b95e1098fee6b37abe4498e301f52a0da29558ef7f79638b4","ownCFRPresenceUpdate":"e771ec9e8b4276c5178ab77f5446f551f403354cec3127c2771a1b55a005e7a4","ownCFPPresenceUpdate":"d6c2db03be9dab1c02882d1bb750c00c6ab018ac1e4c380ff3df08e986f89d28","ownFeatureDataInitialEmpty":"6bca2a6a58b6853e1f06a31e762a08099f445c9907929d3c62262b7362cc25b0","ownWheelReset":"50084c2aadb9765c804e029804aa98ff75748b42bdd578fd164ee1b133b4428a","ownPickButtonCallback":"cdbeef8c996a8e777a290c15c9fecaf31bbad9981db0c1875d8df446d7d6ae2e","ownPickSelect":"9c9d4eca205a047e066951b93966c4fa3d7b286f8d5191cd5bb2aa0b95d3c803","ownPostPickDecision":"787dc417e8f26089849116c83f7d1e097faadf6d1200dbed305ba7dcdae1fa65","ownIFGTDisplay":"01db3361f11f4b2754e790f6f91a698defb173692bd2b5cb9b02fa8af148ee41","ownIFGTTextboxOnly":"ff152a54742916860d08fea45f95b954f34a0fc5315e71b48cd73523a90cfb6f","ownSummaryExit":"b4e573e2a7179f5b309ad7bc4b6fbe72a40a568f2067d18715cbb4267d807042","ownCAPSPresenceObservedAtPostPick":"56c9aa2113f32db395490da6a3254c2acdf27ba9774e8d4315841a5f7ccc8bd8","ownCAPSSkipsFeatureEndRequest":"9b2686ab5979f6b17297bb0364c45147308f72befa0ceb65c75911c1ce53b9bb","ownNextStateTable":"abbbcc443c7dc421a0f8f2452f038211d5d0e9d490a8b06e8c44ae81d83768df"},"profile":"own-RhinoRampage-CFG0-wheel","sourceLocalRoundOrdinalInitial":0,"sourceLocalRoundOrdinalIncrementAfterCallback":true,"sourcePickNumberFixed":0,"sourcePickValueFixed":0,"sourceNoCardArrayChoiceRequired":true,"postPickSelector":"own-presence-updated-CFP-le-FTV-roundCount-at-own-CFR-minus-one-and-not-own-cap","sourceFeatureDataInitiallyEmpty":true,"sourceCFRAndCFPUpdatedOnlyWhenActuallyPresent":true,"sourceCFRAndCFPAbsentRetainsOnlyOwnPreviouslyDecodedValue":true,"sourceUndefinedComparisonSelectsFeatureEnd":true,"sourceFPMDecodedButNotNormalPickRequestConstructor":true,"sourceIFGTIsTextboxOnly":true,"summaryLocalEvent":"CLOSE_FEATURE_SUMMARY","summaryOwnExitCodeWhenCFG0":1,"ownCAPSEarlyFeatureEndSkip":true,"ownCAPSPositiveObservedAtOwnFeaturePostPick":true,"ownCAPSValueIsFlowSelectorNotPrizeMath":true,"sourceOptionalPickGSDOnlyWhenOwnActualPickGSDNonempty":true}};
Object.assign(profiles,{"32707":{"gameId":"32707","dbName":"sg_dancingdrumsprosperity96","runtimeGameId":33107,"runtimeSlug":"dancingdrumsprosperity96","ownSDKFileSHA256":"183aa27737161a22c4f51a97216777fe57d8d1582b799c57da4c45b96a6a71c8","cfg":0,"ftvKey":"FTV_0","kind":"drums-two-round-cards"},"32736":{"gameId":"32736","dbName":"sg_squidgameoneluckyday96","runtimeGameId":33136,"runtimeSlug":"squidgameoneluckyday96","ownSDKFileSHA256":"2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f","cfg":3,"ftvKey":"FTV_3","kind":"squid-bridge"}});
const expectedBundleFeatureBindings:Record<string,any>={"32707":{"version":"own-bundle-source-network-feature-next-draft-v1","gameId":"32707","dbName":"sg_dancingdrumsprosperity96","runtimeGameId":33107,"runtimeSlug":"dancingdrumsprosperity96","ownSDKFileSHA256":"183aa27737161a22c4f51a97216777fe57d8d1582b799c57da4c45b96a6a71c8","profile":"drums-two-round-cards","requestCFG":0,"sourceHashes":{"ownFeatureCtor":"ae129ec389b137346cecfe20744c9f422f50b74faac9b865fceeb93a52dd097c","ownSourceFeatureSequence":"eba5bab61fcde579b408887bd5b70dc8ead46367f42565f315abbee1e7579019","ownSourceJackpotIntro":"bcc1a6af739b0541c3ae593f404a8244c36244dd89ace29efd1a6169382dd94a","ownSourcePickCallback":"9b173a72d0b3650963c36f415f638690ca9368ec1c30221e4533f218f1a15bec","ownSourceEndCaller":"97ef62db862fb21d98ba80668579a7438f6ed0e336c0f0bc5efc7e976c27d214","ownSourceEnabledCards":"b81668a791e76aad7f3649891b37b3ddb46418513b663a1180ab3b2d1bbbd55a","ownSourceGridCreate":"11c79731b08610e76c5a4785753f12f0858a9614120310c42fe6e1fbe1e305b2","ownSourceCardConsumption":"09f6f6ccc5024814cf24990800275c9e44a83516986706cdd17bca82e9c8ef52","ownOwnCardCallback":"090951a251c9dc35b2e671f47a435c6a1d15a0738c8e84b7185c475fa964bdac","ownPortraitGrid":"6f187f127469d89398d220639fb2d82b55893a8daa94c6e25da5925d795a0335","ownLandscapeGrid":"6e91e831de0a9843f8541dc896d15af3dfc56c372e4255b7087ab5260a8134ca","ownSourceSerializer":"942f06bb56f89aff23fcbccc15d1e861953ae28eba9704870ffc75086e7e047a","ownSourceFeatureEntry":"3a9d8e39b426ecd34ead454672cfcc6abbb69542c35094dfb653f6a0b502300b","ownSourceTypeDispatch":"0134b9519b14304bd13c9dc471782b4a59b3bc035717da3aceaf194ca46a9d9c","ownSourceFreeRequestCtor":"6d93f9c4774f88b1f3708a891d5924bfd78bb410e23b590d02ea6a95599439d5","ownSourceFreeRequestCaller":"cba80a91a035ad08a1048fc2a6d43a62ecdb58eab6f69dd1b3575052f12012e9","ownSourceFreeEventSelector":"8cc5014bc3df42bcea5b26c8ef54791ef84e28c9d98f6d1cd8ad0217032eb89d"},"sourceProofSHA256":"dce7dc568198fc65945f140c5417c911cfa4aab5f7472e86c55f652c8940b502","sourceTerminalCallbackProofSHA256":null,"exactGSDWireBindingCorrectionSHA256":null,"freeRequestParams":{"GN":"dancingdrumsprosperity96","BPR":"108","RB":"5"},"featureRequestParams":{"GN":"dancingdrumsprosperity96","CFG":"0"},"FPSerializer":"infix-round-ordinal-enabled-card-no-trailing-delimiter","explicitLegalChoicePolicy":"first-source-enabled-unconsumed-card","sourceChoiceDomain":[0,1,2,3,4,5,6,7,8,9,10,11],"actualTerminalSourceSelector":"own-K0-minus-one-and-CFGG-zero-or-source-FEATURE_END-local-exit","sourceContextModeIsNotResponseCFG":false,"requestFieldsOnlyFromOwnActualCaller":true,"ownCurrentPaidPrefixesObserved":1,"ownNaturalFeatureProviderResponsesObserved":0,"ownNaturalFeatureTerminalCoverage":0,"currentPacketAndAllRawRequestsResponsesPreserved":true,"originalAGCashEnvelopeReplayMongoRequired":true,"oldUnknownPOSTNeverReplayed":true,"unknownDBWritesNeverRetried":true,"noDefaultAmountOrBonus":true,"noSyntheticNFGOrTerminal":true,"boundedOriginalAGFollowupBudgetRequired":true,"otherActualNetworkModesRemainFatal":true,"sourceLocalTerminalDoesNotInventWrapperEndGameACK":true},"32736":{"version":"own-bundle-source-network-feature-next-draft-v1","gameId":"32736","dbName":"sg_squidgameoneluckyday96","runtimeGameId":33136,"runtimeSlug":"squidgameoneluckyday96","ownSDKFileSHA256":"2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f","profile":"squid-bridge","requestCFG":3,"sourceHashes":{"null-optional-property-serialization":"80667a5973e05d6caa9e0810cec21f35fbadc662c6863ca23e490f07b24113db","infix-serialization-no-empty-trailing-fields":"004d48b22318bb251968af546968a1e6507819ce6ce92861c7ff396ccf4fdb66","Ox-object-array-infix":"10eefaa328b9504b48c6463de083e378be788f35feffd3a170765b9242250872","own-FP-type-and-request-constructor":"415e7c460643af392f53012961ca3d8d48b7bdbbda242ede5c72fe2c8326d9cb","current-bridge-fields-and-FID4-map":"20a4ab09bd611cab18e43d137de9795c83b8d53d23c61b3754b25fcd1e2721d4","bridge-real-start-pick-caller":"620df8c89cf9c325853eac644b8d6ee789bde5863765d175a6858a83497649b2","bridge-current-survived-presence-pick-stop":"c38867dc2f0ea31580e023237a1a8d0ea155c7d957db05258f5c6b5d7ff9c81d","bridge-skip-feature-end-if-FID4":"4d4bf8a94cf98142291d0da4a925a3ab807e5524c361e26f93ec570bf20ef6e9","actual-request-selector":"7e99c6c30ca26f878454f2af4dfab2fcdaed44a1582f49b9e1a193951365585b","generic-free-request-BPL-LB-constructor":"4f16cd28b9712dd3432a475c11806ac2b67c79de6790a4f5ccbb5daf61d7987b","own-Hna-always-current-stake-and-lines":"a8bd6e136d6a69ea4427659b433c1a81ce9b9ecd0553cfb55adf297a21cd88d3","generic-NFG-free-request-selector":"b19ef3795f9646d66788a743e180f54599f497db1a778e592e85136c75c4d05a","current-NFG-free-counter-and-free-pending":"9e5a509361a1123319496a5f93b8fff5735d14436ea52918a53111be80721b11","bridge-free-GCT-stop-and-zero-counter-handling":"d26d3fa86f3221502c15e81cdf761be0ce2f327d0f991a78ed39930b1205e4e4","bridge-free-on-endplay":"fe0640867f79777133df93e483da5bbc18f31e3fe460efd57d38aa1b9ecd62b9","own-qO-pending-feature-IDs":"dc64557c0887bb4b2506b3996e3c58800186be3b61df91a8dfb56d843fe46ad2","FID-NFG-GCT-serialization-fields":"e9236a8370075e02f69a49416cec3075f97ec7c5bcf5f2191253d6e22b5e2c96","source-enumeration-Bridge3-Free4":"37afac8d1a00b1a4807636d309c5bc611771221627862528311f22bcb712fedb","generic-MSGID-and-REC-request-only":"bfd0524a4b1177eba12f15498b76f8c2e8ac39b2cc8d1f9569f527223e903ded","own-ui-real-mg-wrapper":"50c70489984e761b39ca6ea79ae59aefe7871fb01fdd6d096fa8e121c471e79a"},"sourceProofSHA256":"58a88d4de943b2cb64798dc9aa7a3a533429b5bc7ad9b9f6f294e869f980dd01","sourceTerminalCallbackProofSHA256":"d268fd00d49ee752e71710b7b83dbedc224e812343be650fdc1674e91169696b","exactGSDWireBindingCorrectionSHA256":"086da279feee3d819b63f6f80e9470bf873ff2136b56f0b4e95107e5ce9bf5e8","freeRequestParams":{"GN":"squidgameoneluckyday96","BPL":"5","LB":"10"},"featureRequestParams":{"GN":"squidgameoneluckyday96","BPL":"5","CFG":"3"},"FPSerializer":"infix-skip-null-only-own-left-right-round","explicitLegalChoicePolicy":"left-option-zero-from-own-two-choices","sourceChoiceDomain":[0,1],"actualTerminalSourceSelector":"actual-GSD.FEATURE_ID4-no-FID3-NFG0-source-Ready-ROUND0","sourceContextModeIsNotResponseCFG":true,"requestFieldsOnlyFromOwnActualCaller":true,"ownCurrentPaidPrefixesObserved":1,"ownNaturalFeatureProviderResponsesObserved":0,"ownNaturalFeatureTerminalCoverage":0,"currentPacketAndAllRawRequestsResponsesPreserved":true,"originalAGCashEnvelopeReplayMongoRequired":true,"oldUnknownPOSTNeverReplayed":true,"unknownDBWritesNeverRetried":true,"noDefaultAmountOrBonus":true,"noSyntheticNFGOrTerminal":true,"boundedOriginalAGFollowupBudgetRequired":true,"otherActualNetworkModesRemainFatal":true,"sourceLocalTerminalDoesNotInventWrapperEndGameACK":true}};
const expectedOwnAdditionalBundleNextModes:Record<string,any>={"32707":{"version":"own-current-closed-caller-additional-next-modes-v2","gameId":"32707","allowedActualModes":[1,3],"ownSDKFileSHA256":"183aa27737161a22c4f51a97216777fe57d8d1582b799c57da4c45b96a6a71c8","sourcePointProofSHA256":"c2f4299dccadaa7dcfb7845a18e328e0bb8067e8bf0b04a777f199d7644786a7","sourceFeatureCFG":"own-current-CFG-1-or-3","sourceFiniteCoinChoiceIndices":[0,1,2,3,4],"explicitOwnChoiceIndex":0,"sourcePickFP":"1|1|1","sourcePickOneThenEnd":true,"sourceDisplayFTVIsNotAWinOrTerminalGate":true,"actualOldUnknownPOSTNeverReplayed":true,"noNaturalACKOrTerminalSynthesized":true},"32736":{"version":"own-current-closed-caller-additional-next-modes-v2","gameId":"32736","allowedActualModes":[1],"ownSDKFileSHA256":"2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f","sourcePointProofSHA256":"c2f4299dccadaa7dcfb7845a18e328e0bb8067e8bf0b04a777f199d7644786a7","sourceGSDModeField":"FEATURE_ID","sourceFiniteUserStepChoices":[1,2,3,4,5],"explicitOwnChoiceStep":1,"sourceRemainingPathCells":24,"sourcePresenceUpdatedStepField":"RLGL_STEP","sourcePickStopFields":["RLGL_DIED","RLGL_WON"],"sourceStartedField":"FS_1","sourceOptionalNullTupleComponentsOmitted":true,"sourceRequestCFG":1,"actualOldUnknownPOSTNeverReplayed":true,"noNaturalACKOrTerminalSynthesized":true}};
const expectedOwnEndNextV3:Record<string,any>={"32707":{"version":"own-source-FEATURE_END-to-free-priority-v3","gameId":"32707","ownSDKFileSHA256":"183aa27737161a22c4f51a97216777fe57d8d1582b799c57da4c45b96a6a71c8","sourcePointProofSHA256":"35b6d0db49331d43620be81746bad9b55ddb6c40ff247732f32bbae6cfc4310b","actualRemainingWireKey":"NFG","ownSourceFreeMode":2,"nextEvent":"FREE_GAME","sourceRequestParametersUnchanged":true,"retainedPreviousFeatureIDDoesNotRestartEndedFeature":true,"zeroRemainingWithinOwnFreeContextSelectsSourceTerminal":true,"sourceGCTTrueOrOneStillStops":true,"noCounterDefaults":true,"noAmountOrDisplayGateAdded":true,"allRawRequestsResponsesPreserved":true,"oldUnknownPOSTNeverReplayed":true,"noProviderACKorTerminalSynthesized":true},"32736":{"version":"own-source-FEATURE_END-to-free-priority-v3","gameId":"32736","ownSDKFileSHA256":"2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f","sourcePointProofSHA256":"35b6d0db49331d43620be81746bad9b55ddb6c40ff247732f32bbae6cfc4310b","actualRemainingWireKey":"NFG","ownSourceFreeMode":4,"nextEvent":"FREE_GAME","sourceRequestParametersUnchanged":true,"retainedPreviousFeatureIDDoesNotRestartEndedFeature":true,"zeroRemainingWithinOwnFreeContextSelectsSourceTerminal":true,"sourceGCTTrueOrOneStillStops":true,"noCounterDefaults":true,"noAmountOrDisplayGateAdded":true,"allRawRequestsResponsesPreserved":true,"oldUnknownPOSTNeverReplayed":true,"noProviderACKorTerminalSynthesized":true}};
const expectedOwnDancingMode4EndV4={"version":"own-Dancing-Coin3-End-to-source-free4-v4","gameId":"32707","ownSDKFileSHA256":"183aa27737161a22c4f51a97216777fe57d8d1582b799c57da4c45b96a6a71c8","ownSourcePointProofSHA256":"35b6d0db49331d43620be81746bad9b55ddb6c40ff247732f32bbae6cfc4310b","ownCoinCFG":3,"ownFreeMode":4,"actualRemainingWireKey":"NFG","sourceHashes":{"source-free-mode2-response-dispatch":"f9db30132a35ea7693733df2d48aef50bcd106562bb2c4777bbae8bd1f0787be","source-free-feature-mode2":"f76b0896fc0e8738eae45279297d06bebac0807dd412d4ee78a596c4fd9105cf","source-Coin-End-clears-network-flag":"ed443212ca1f7233eda61bf0cabc62be50cc4a6f0a789bd27e7c3f9381047905","source-positive-free-request-selector":"e5702907dbf2abd96dd34bb9537ae8c3b5eb6f4cfe3041908555d27415e98a7b","source-NFG-zero-terminal-pending-selector":"1942a56d87619769c442ed52b4438afac6af0a64eaa425a667446fb5d37c0d86"},"nextEvent":"FREE_GAME","ownRequestParametersUnchanged":true,"rawResponseUnchanged":true,"noMoneyOrDisplayGate":true,"noRemainingDefault":true,"unknownPOSTNeverReplayed":true,"noProviderACKOrEndSynthesized":true};
const expectedOwnSquidTugOfWarV4={"version":"own-Squid-TugOfWar-source-generic-free-next-end-v4","gameId":"32736","ownSDKFileSHA256":"2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f","ownLiteralCachedSourceProofSHA256":{"own-TugOfWar-mode0-literal-callers-private.json":"c2dd2c022dbef81efc9bd421abed77b5b13e7db43e8f6dc1a8247c7b678d10e4","own-TugOfWar-generic-next-state-extra-points-private.json":"450b1025ce8cc1aed1e301737aec33e08c5e369e8c10919ad40519aea829b4d5","own-TugOfWar-generic-request-and-local-terminal-points-private.json":"7ab8c183355ceac538ad4031a18de0e5da09d2499eb6436d4c39edd75a30d503"},"ownSourceHashes":{"own-TugOfWar-mode0-yXa-response-to-context":"8058e466d3f8551c9643f6709740fa2f100c783abd31e5e70a0aa4f9e5206436","own-TugOfWar-Nc-state-caller-and-terminal-class":"d590b17a125baddc7d9890e9332b39f83dc3155cd055a217220957b59b3ee276","own-generic-stopped-all-feature-return-null-oQa-next-state":"a16b9b36ddc92fb430300f28981bab76ad2edabba42b5f021fd6f24779113168","own-GCT-binds-source-terminal-flag":"26f5f07469b996dd37d104ad0d4819f14303110c0a19edcb8cd3941039ffdf10","generic-actual-spin-caller-no-feature-request-params":"0fcc4aab2ff314930b82cba7936da93b65532c96fa5bc1a77325d2780c8e6d21","generic-current-wager-lines-params":"0dac08ea22ffd05ad0bde66112bfe18cbddadcd09a6dc7de6650e245757875b8","generic-current-stake-selector":"120d79a960f5110daf5ede940174029b506351a9c12228d7cf8bb822d929517d","own-terminal-postplay-close-and-return-idle":"40a14b9b8856787319b8bb9f220995400e5b5c7990f6e122d3a3f8666a987f11","own-JH-zero-remaining-or-GCT-free-exit":"85a9ae6ee378f78512b45f744badc835ad01a5b556ffb828666a6105380f875f","FREE_GAME-exact-enumeration":"bee5c687970352b9bd358bfc647dd19e9766f3ae29caa94d0b72b02b62227c3e"},"ownActualGSDContextMode":0,"ownCurrentRequestParams":{"GN":"squidgameoneluckyday96","BPL":"5","LB":"10"},"nextEvent":"FREE_GAME","noFeatureStartPickEndRequestForTug":true,"actualNFGToSourceEbGe":true,"actualPositiveGeAndNotGCTSelectsOwnGenericFree":true,"ownPreviouslySelectedTugContextRetainedOnlyIfCurrentFEATURE_IDAbsent":true,"sourceTugZeroGeOrGCTLocalCloseReturnsToIdleWithoutNetworkEnd":true,"noRawFIDMutation":true,"noCounterDefault":true,"noMoneyDisplayOrCombinationGate":true,"oldUnknownPOSTNeverReplayed":true,"unknownDBWritesNeverRetried":true,"futureNaturalACKCoverage":0,"noFutureProviderResponseOrTerminalSynthesized":true};
// Own 32489/32705 fixed-SDK single picker. No other DATA selects this leaf.
const ownLinkedPickerProfiles:Record<string,OwnNOVAFeatureProfile>={"32489":{"gameId":"32489","dbName":"sg_dancingdrumslink96","runtimeGameId":33031,"runtimeSlug":"dancingdrumslink96","ownSDKFileSHA256":"e14c46944e23a058702352c9568ecd32c1c9d59a6437f897e6846321431fc9e7","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick"},"32705":{"gameId":"32705","dbName":"sg_dancingdrumslinkfortune96","runtimeGameId":33105,"runtimeSlug":"dancingdrumslinkfortune96","ownSDKFileSHA256":"4e0bca40eb86541a64f42dd230471dd515cd5f06aaab1c5de56bc97a8d542922","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick"},"32706":{"gameId":"32706","dbName":"sg_dancingdrumslinkhighlimit96","runtimeGameId":33106,"runtimeSlug":"dancingdrumslinkhighlimit96","ownSDKFileSHA256":"67b38f1aa0eeac5c304443f8200e0cdc32ceaa27d613f3f8c24834696f295f85","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick"}};
const expectedOwnLinkedPickerBindings:Record<string,any>={"32489":{"version":"own-linked-one-pick-next-end-v1","gameId":"32489","dbName":"sg_dancingdrumslink96","runtimeGameId":33031,"runtimeSlug":"dancingdrumslink96","ownSDKFileSHA256":"e14c46944e23a058702352c9568ecd32c1c9d59a6437f897e6846321431fc9e7","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick","sourceProofSHA256":"862b9d6232758a8ad953e016c602f5181ee7264c1c61311084e650b9e1d11b4e","sourceHashes":{"ownPendingMethod":"af52dd2242c7fca6ffe60e7167e3e46b28b375f6ac0f701682beabd7cea69981","baseFinalGetter":"454e59f0831211763d1e061257575f8a065792d15c6828dd35b4cd02a6db6439","ownResponseFeatureAndPickerState":"d75dd2294cf9e7e8eb7adc41357167f3c00dd4aa43acb32281fee280d1e81106","ownResponsePickerControl":"a9dae254cecb8b08e18b3b124e59086d3a7e404ddcfd6f92852bd96fa192a090","ownPaidAndFreeRequestConstructor":"b54779e90d6300b8fb4034011dda2535206aaa5448ae7a4af223f5297322c29a","ownPickerRequestConstructorAndTypedFP":"fe4708ca270dc74a6abc231b676cd5f8a58563faa4e6831704218e69dcd2c77a","ownActualGDMProfiles":"a356fd7df6702d0c8e0bf73198b4db9ff7d4b0bde2ac4fcf85a3db50507f5cf1","ownFeatureTransportCallers":"ea70688054787b061ba0620ea8efa45066441b24989cbcf70e002f14d331ca47","ownFeatureStartLocalACK":"caa98e987e8857f1fc08bfca61e576d42e68db422dec25fd045d9ef0bda294e9","ownFeaturePickLocalACK":"8968d9dff7eecabb45316052c98369a4982612c54489115496c95e2bd0cfb266","ownFeatureEndLocalACK":"e6ba2cdf34765c718ef11c5b3a5a89671fa99f88e3e0322d19e4d7c1c7016719","ownPickerNextState":"fce791882f59b2c452c5bc5f6cba636203c0f68bc5eb1149a3b30aee3cf65344","ownFreeRequestSelector":"04f9b01498bbccaf0fa61c53a59d95eee16d13852a525650829ee81e99d186f3","ownNFGStateSetter":"e119b1a240fce07c395d13aab4097f81a29656dd9797f2e2ad05a2d02753b9be","ownFeatureAndReelConstants":"26a5c3462aba9677d40fc589b5b0dc88c1b00ebeb6869e5b0945f6790b0b7066","ownFeatureKindEnum":"cc8112be3ab12f002d960a3f3cd1985f539cda37bf6eaca1cd1b36a14d0d705c","ownFivePhysicalChoicesBothOrientations":"3e66007f90f1f1378c9673d22b3f5f07a5f899d7858ae74f054be07d3e2c3ff8","ownCardGridIndexes":"b68ce65594753f37d334ae69e5b52b12b41e3a2fef93e9e83db72e3d763e9365","ownCardIndexSetter":"eaee19559a7842b750e47bf7c56876704631127cfe2f2ef0666ca7b0957ceed7","ownBooleanDecoder":"0bd27455d4e70097fa2422abacf0ce67b79e7ec9ba39f4c71a2d99592586dc0a","ownBooleanCodecOptions":"b8692dcb75c3a38341ecb72b84c81d12ea017e3b17695f1bf2ff49bc616348b3","ownGSDVPCDecoder":"ccfff579f7d11c24af1f6f66d64328de31a6c47b46bf1e756bbdedf8f13c299e","ownIndexedFSBooleanDecoder":"9f25d21e9f74751cc76228273bab8de6c0feb11cb30815a78bf1d981e40307aa"},"sourceChoiceIndices":[0,1,2,3,4],"explicitChoiceIndex":0,"pickFP":"1|1|0","paidRequestParams":{"GN":"dancingdrumslink96","AP":"false","BPR":"352","RB":"5"},"freeRequestParams":{"GN":"dancingdrumslink96","BPR":"352","RB":"5"},"fixtureACKIsNotProviderACK":true},"32705":{"version":"own-linked-one-pick-next-end-v1","gameId":"32705","dbName":"sg_dancingdrumslinkfortune96","runtimeGameId":33105,"runtimeSlug":"dancingdrumslinkfortune96","ownSDKFileSHA256":"4e0bca40eb86541a64f42dd230471dd515cd5f06aaab1c5de56bc97a8d542922","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick","sourceProofSHA256":"e495c08c935702d7195da360a18a1c91cade7b142b71e5a23f3802a7e5aa914e","sourceHashes":{"rbConstant":"2b91f150427674a6e8417a929c7b8a1e15acae6643f5329b20cc1e3323292f8f","cfgConstant":"2bbb1e04649aa52727e0348ae36b0668f2f60e7b8379259c481a2c6bd9dee5c8","featureEnum":"c1a5a162b87322c405c93c433844a6bdce06fde6be45bb362f435b0aca8139cc","messageTypes":"74e812d4d055681c76ff5f808b0b27067736b1aebe9bbbd1090139a275eb256e","freeMessageType":"8472bebb6264f0d5cf4276658a56b9610ace51c8070792ad0ee0fe65c0db565e","terminalGetter":"5fb8f78b6e0b2148ae95924e966b65088bd78aab235183e22e98110c225f6309","basePending":"c1de0cb0ae328541553b4bd08466a544fc3b12cc6c87cb958124a17a96cea623","genericPending":"b3445113e1267879514db3bd5518ade1e0525fdb6e8ee1b36ed78fece15cfe25","ownPending":"126299c9f17b52cc26ef121f5eb0cf9d6123b3c066841408c27fb818ca8bb5a3","responseFeatureRouting":"a935c036999d389b5ad54dd562282a2c3efd21f8ed966c5498c2384106e9d49e","vpcMetadata":"cfde07866c7f884773a8babe997ee64abe59add444fdd5554dbbd3625df09291","ownPaidFreeConstructor":"46b1b3cde5a1ffa170e5e4db9257515a0a1e4973384d842efc9e302d1c25402c","genericFreeSelector":"bb909deecb57c96965b36bc76ac77a455d3938865c44c147a6baf4e31f53ac34","nfgStateSetter":"de85aab5215ceccde7726bfc2cea6a12c78af2b3362b79035e9c18b2e22df104","genericPaidFreeCaller":"0a09ecc71e55e2a13d9a826dcf8712fb2785eb27735c6e60a8d93bf51e19e9f5","lockedStakeCaller":"82957766b7e5d9a59c17f7b0f7bf3acaa3a47335c919f8402f4338f50f1a46e0","ownFeatureSequenceStart":"54c68eff3e9a176be453a5dd29b37b27befbe3e63de9358fc8a51828bbe26560","ownFeatureSequencePick":"89e9900fd1984ea095a84ae04b3be5e906c95ab22db581007177454476eff4a3","ownFeatureSequenceEnd":"20c3f3b8d09da424f61a43768da4d1debf5ff2d106237eae53898fe05225c5e0","ownFeatureConstructorAndFP":"63116b3abbbfeb2275bdfc54519bed8bb2c11f12c7817eaed5f2296f7b201828","selectedRuntimeRequests":"fed284438b728875f2570ef91ca1be1a2138251bfa46a72f637a23da0213807e","ownFeatureEngineCallers":"511caadf4a767e8e446c63da52a7080b9978d0a7efdf86996f5eb80f38c2c558","featureStartCaller":"fb705624ef2766fba5ed4fb028f542130fe0ec706f8f2b43324b3fd817e439ad","featurePickCaller":"73837b296f583f685f0c26a878fc4f67f4a4a6197cfca4ccdbbed05d5c97afc6","featureEndCaller":"21e61f25f2c959ab4583aabde19ef38f71fc3bea7bf13c8aae53c6c1e899318f","ownPickerStateSelector":"0186f8e879c468c71fc49875b69d1611146f7f28c653e8cb9160bc8896ceab31","pickerCardIndexGetter":"4ab412391f6805ffbcb495d3916cddf2d94d1df66d317be5ffa0558b0e7eac59","pickerCardIndexSetter":"5d1d15f217d2cc4cc281b4c5a11c44e004c0eeacd3400da8c39361afa553b8f4","pickerIndexEventChain":"a4cb8b85d0a1dfafad1675bbcb8eb9653b49a596d623306e6e864a63861dcf53","pickerConfiguration":"91dd324d195b4997e620daf9244e85c1ea193d16540a74c3434c84b43ebdfd73","actualPanelGetter":"24812d2c5945e2631a3e98f8576acc53e89a37b832a2e4f4a74dbf9e3801d5c1","actualPanelFactory":"a238307e30e6877f72cdb0e45ee783a70e6654c70a970c0dda573af5ecfbb8e4","fsDecoder":"455809d21cd25c3959d64bb03288f7e8b9398b6ebc4826aabd51ac9f673abc18","nfgDecoder":"e8496f2b3b771da92c88b19ef61886ef4045fef2aa23a7739bdd0248d45a52e5","gctDecoder":"c000f96a4be9bcd233ef58fef8a9975bfae21239a826c82024ddc3e5ea494fa7","fidDecoder":"5c8654be115be7dbbd51217bf2ff3942cbc458f9a80c494112f8d59206e06372"},"sourceChoiceIndices":[0,1,2,3,4],"explicitChoiceIndex":0,"pickFP":"1|1|0","paidRequestParams":{"GN":"dancingdrumslinkfortune96","AP":"false","BPR":"352","RB":"5"},"freeRequestParams":{"GN":"dancingdrumslinkfortune96","BPR":"352","RB":"5"},"fixtureACKIsNotProviderACK":true},"32706":{"version":"own-linked-one-pick-next-end-v1","gameId":"32706","dbName":"sg_dancingdrumslinkhighlimit96","runtimeGameId":33106,"runtimeSlug":"dancingdrumslinkhighlimit96","ownSDKFileSHA256":"67b38f1aa0eeac5c304443f8200e0cdc32ceaa27d613f3f8c24834696f295f85","cfg":1,"ftvKey":"__own_linked_picker_no_FTV_selector__","kind":"linked-one-pick","sourceProofSHA256":"137968f5994ee4d6405b8d3e0af166b973a91c73a5d541ff8253b9535c6d7346","globalFeatureOrderProofSHA256":"a348a5de521ef76264b9273bff53d197d9916ee22a670363b933d82cac9a789b","sourceHashes":{"basePopulateModels":"920fc52d9bb63b948ca3ba6a04f307f0d6517fe1e2b09ae88065c627350bfa52","freeSelector":"2add24d6ad787721b14c2f1963fbb8ea58762b597e462b51d73c7f1785a38fac","NFGSetter":"823a93917affd333b8cd3c4ea40c612cfff19bf7d3d83e959c23d396030edb4e","ownPending":"07b39684420ae3b50f95fcbf9f716004997b506a02977764db86a88a93ee4215","parseFeatureData":"bf5978a4155925074ecfc47e36510acca01b960c25486c1233c7951334bbe813","parsePickerData":"6cc620f1f90f88578745a91be8298b03a863aea4afc7b33c21f559954f2f67df","createCards":"2b8e8dc13d3a6d3831b2be40333cb48320d4f411b3b1b95abf9dd057339b1f13","createCard":"05fb7ab7c075de050e5432911a1b4384fabb38f94af6d739094b2429827246c7","cardSelection":"fb8a3cde9b1c7190820f3a92ce06095d902d22aa129fd2553901d67267d97da8","finalGetter":"5a914f248777e0b51386a5bdcb6326502bdc94711502d2cd72fecf312068b5d4","NFGDecoder":"058808b25719d14ba845edafcceeb1aef78545bfb95eb2eaacb18996e0de2ee9","GCTDecoder":"a567b33ac5066f93ec1567b545c3ea8076817d13adea633301473c31ea59ed11","IFGDecoder":"b8548a4306f48128cfd035da6717da56208438bff9fbd6afe612138518f9c943","GADecoder":"772c149bb48a6e78c13cb15e734b749b1c8cdd6c78f2dc20f34e1e19de1e66f5","BDecoder":"6d36107caa339529c190b2c63f3864d76a390219e735695bbf4c8a3995665b3d","ABDecoder":"959e3f8b760401ca9c5e4595112e592e29052cf52bebad0e16786f66ab711647","TWDecoder":"d0ca99eb6403e93a596537bf5edca2a71ab4122aa2c32a3404f0f6c3ce43a4c3","FIDDecoder":"662872158b61d2011ca6649742f0544e5b6f3a74e2ca20302dd896daf60a92d8","FSDecoder":"1a799fbff40fb84bc322151cb101059f1073fc5f5edb798943215ebdac44162c","VPCDecoder":"69f83162265cefa9847110f03cb932e00757995ee091bfa596e9f9b91da8b05b","BPRDecoder":"d989cb20c31bfe55e67ccd16374336a8dd24667e34f12b9b6af98d4b7272ac42","RBDecoder":"a344c0bcf835f8d95ff98553b7f3299881b30d3e0f77f4293023a038fde8af3c","ownRequestCtor":"e3083f7c59c5f00a23ed273a69ef84245bfeaffaec042b900ed40caa3fce23f6","featureCtor":"89ea44d3f7bc58dd16897de9ccc3a7e70322830f159b8c04b98e52aaae763664","engineSettings":"c9846204184b61519d5cde9fac3d48624d70d9b1875600d258ab8612fe2f122c","ownConstants":"39449ac8a2a979f52ec8539d0227ffcd2a3fd91df8ee6a41ea74564fa6f7e279","physicalCards":"626226611ee25c35841217b96adb681b8654f3c4d8ffe03640c4936906b61d7f","uiFreeEndPlay":"b014612375ad4b97ffd5a65a74342b93b1ec8232465288cd712434d5478c5301","outerEndPlay":"fd1210ab841d0e0163a5f14b2fef6765f77fb64a72a00d3a8845783125769c5b","ownPickerBeforeFreeEndPlay":"91eb1b092574a2f241ed1e6b5a9067c1aa6682740e66c51a82acb7e138ceb5c0","outerEndWinRenderingDispatch":"d7381a0143d82108e121bc3a9cf19ed649516af1fdfda4a3e9e2e1ebe1a4d133","ownFeatureFactoryOrder":"9e5b95fcd9ed571323ea9f47e03e60ba2a20a87e4b5c32dfe08467b1ce5232a3","ownFeatureEndClearsTriggeredAfterACK":"ad978bef8fced977eee1b0b775cdce236f014d793a5ef5689755f0f8c287488d"},"sourceChoiceIndices":[0,1,2,3,4],"explicitChoiceIndex":0,"pickFP":"1|1|0","paidRequestParams":{"GN":"dancingdrumslinkhighlimit96","AP":"false","BPR":"2200","RB":"5"},"freeRequestParams":{"GN":"dancingdrumslinkhighlimit96","BPR":"2200","RB":"5"},"fixtureACKIsNotProviderACK":true,"ownActivePickerBeforeFreeSelector":true,"ownTruthfulFreeRequestSelectorIncludesNegativeRemaining":true,"GCTMaxWinStopsBeforeFreeSelector":true,"GCTWithActivePickerStillUnknown":true,"ownUIUnlimitedFreeWholeClosureNotClaimed":true}};
function ownLinkedPickerProfile(game:any):OwnNOVAFeatureProfile|undefined {
 const c=game.sg.ownGDMContract,b=c.ownRootNFGFlowOnlyCapture?.ownLinkedPickerNext;if(!b)return undefined;
 const p=ownLinkedPickerProfiles[game.gameId];assert(p&&game.dbName===p.dbName&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&c.ownSDKFileSHA256===p.ownSDKFileSHA256,'AG integrity: own linked picker exact SDK scope');
 assert.deepStrictEqual(b,expectedOwnLinkedPickerBindings[game.gameId],'AG integrity: own linked picker fixed caller binding');
 assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: own linked picker paid request');assert.deepStrictEqual(c.freeBudgetContract.freeRequestParams,b.freeRequestParams,'AG integrity: own linked picker FREE request');return p;
}
export function ownNOVAFeatureProfile(game:any):OwnNOVAFeatureProfile|undefined {
 const linked=ownLinkedPickerProfile(game);if(linked)return linked;
 const c=game.sg.ownGDMContract,q=c.ownRootNFGFlowOnlyCapture;assert(!(q?.ownNOVAFeatureNextRequest&&q?.ownBundleFeatureNextRequest),'AG integrity: GDM own source network profile ambiguity');const b=q?.ownNOVAFeatureNextRequest??q?.ownBundleFeatureNextRequest;
 if(!b)return undefined;
 const p=profiles[game.gameId];
 assert(p&&game.dbName===p.dbName&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&c.ownSDKFileSHA256===p.ownSDKFileSHA256,'AG integrity: GDM own NOVA feature identity');
 const original={...b};delete original.ownAdditionalSourceNextModesV2;delete original.ownSourceEndNextV3;delete original.ownDancingMode4EndV4;delete original.ownSquidTugOfWarNextV4;
 assert.deepStrictEqual(original,expectedBindings[game.gameId]??expectedBundleFeatureBindings[game.gameId],'AG integrity: GDM own NOVA feature source binding');
 if(b.ownSourceEndNextV3){assert(b.ownAdditionalSourceNextModesV2,'AG integrity: GDM own End next current network scope absent');assert.deepStrictEqual(b.ownSourceEndNextV3,expectedOwnEndNextV3[game.gameId],'AG integrity: GDM own End next source binding');}
 if(b.ownDancingMode4EndV4){assert(game.gameId==='32707'&&b.ownSourceEndNextV3&&b.ownAdditionalSourceNextModesV2,'AG integrity: GDM own Dancing mode4 current End scope absent');assert.deepStrictEqual(b.ownDancingMode4EndV4,expectedOwnDancingMode4EndV4,'AG integrity: GDM own Dancing mode4 End source binding');}
 if(b.ownSquidTugOfWarNextV4){assert(game.gameId==='32736'&&b.ownSourceEndNextV3&&b.ownAdditionalSourceNextModesV2,'AG integrity: GDM own Tug current source scope absent');assert.deepStrictEqual(b.ownSquidTugOfWarNextV4,expectedOwnSquidTugOfWarV4,'AG integrity: GDM own Tug source binding');}
 if(b.ownAdditionalSourceNextModesV2){assert.deepStrictEqual(b.ownAdditionalSourceNextModesV2,expectedOwnAdditionalBundleNextModes[game.gameId],'AG integrity: GDM own additional source next binding');return {...p,endNextV3:!!b.ownSourceEndNextV3,endMode4V4:!!b.ownDancingMode4EndV4,tugOfWarV4:!!b.ownSquidTugOfWarNextV4,additionalModes:[...b.ownAdditionalSourceNextModesV2.allowedActualModes]};}
 return p;
}
Object.assign(profiles,{"32620":{"gameId":"32620","dbName":"sg_quickhitultrapaysmonkeysfortune96","runtimeGameId":33074,"runtimeSlug":"quickhitultrapaysmonkeysfortune96","ownSDKFileSHA256":"5707e28e37ec986dca44e81b5e1909bff34b55192a3f74678d2d9dd26d8c4723","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick"},"32621":{"gameId":"32621","dbName":"sg_qhupwolfmountain96","runtimeGameId":33075,"runtimeSlug":"qhupwolfmountain96","ownSDKFileSHA256":"40fa65a4af877a9d1458330e4440a0be8cbecd0a0e77c4ac678dca066e61704d","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick"},"32732":{"gameId":"32732","dbName":"sg_qhultrapayseaglespeak","runtimeGameId":33132,"runtimeSlug":"qhultrapayseaglespeak","ownSDKFileSHA256":"935c93b053e3fa6afdead000fef8a2cd5b327dc69db407c3767a6c6020594dda","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick"}});
Object.assign(expectedBundleFeatureBindings,{"32620":{"version":"own-QuickHit-Ultra-source-CFG1-local-pick-v1","gameId":"32620","dbName":"sg_quickhitultrapaysmonkeysfortune96","runtimeGameId":33074,"runtimeSlug":"quickhitultrapaysmonkeysfortune96","ownSDKFileSHA256":"5707e28e37ec986dca44e81b5e1909bff34b55192a3f74678d2d9dd26d8c4723","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick","sourceProofSHA256":"03bff9be6f19155f3e53c9b8512c0d82ae72b39f761e23c2db47afb94839958a","ownSourceHashes":{"ownFeatureStateFromActualCFGFTVFSFPM":"f772df59fe19e680a9c3581affea989612a92eeec039cfdf95cc00a9526faf9f","ownCreditValueFromOwnINITRBM":"eafa0e69b869ee2e0fcf75236057786c8e1ad010973b4b9047ec4bc3f74c2e47","ownCreditMultiplierConversion":"e831d7c00acf59ad79fc99205b2c34bfccfecd1253bb7af42e567893f543fb8d","ownPaidBPRAndRBConstructor":"eeae32c0c0a874a41cd43bcf7a4ec4fd5fcb1b5621eee0d6fa3e9d993973842e","ownPhysicalEnabledChoices":"c35b13e18a9887b2af005657666046f3edb52d7881ef051625cdcdfbec413c52","ownChoiceCountTwenty":"9a796a6811debad1cde02babbf83f0b593dd966cc00e39137e1692702412dda2","ownPickCallbackWithLegalSlot":"f0e7d7b936bb4409e61fe5be1e1b3429922428656df78e7eebba9d5de6a75d77","ownCFRPendingDecoder":"60b2ccf359272430c8a1ad68c0dcb19d815390efdc048b7d39a342e2628f78fb","ownCFPPendingDecoder":"74c7cb8b33379529d3ae802e38eb3608536a7e040ba545178944137182b0f68a","ownNFGDecoder":"2facb5b0700b06e32ff8e72668490c7ffe95a0d047924e29c6be0b4314c445cc","ownGCTDecoder":"a261d34ad4185abb7335d6dea5f84de0f7cb3901d331ff51350b57d48640af76","ownFTVDecoder":"47e6e3f5a534a68ec213a9b46102f2a8f53e54adfde29e59ce1fb96c586755ea","ownFeatureRequestConstructor":"41adaf2f0917aff9c7a3994a08a0f11cbd8cffdc135270883ab6f797ee462a6c","ownFeatureNextSelector":"4f7edc4e8df2436be372057dbbbe456ab1d132119ec68cbb9207e678d346315d"},"requestCFG":1,"sourceRoundFixed":1,"sourceLocalOrdinalPlusOne":true,"sourceChoiceDomain":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],"sourceUnconsumedChoiceOnly":true,"sourceTotalFromFTVFirstRowIndexOne":true,"featureEndIsNotSyntheticWholeEnd":true,"actualNaturalFeatureACKCoverage":0,"ordinaryWagerRaw":100,"unmappedNextEndStops":true},"32621":{"version":"own-QuickHit-Ultra-source-CFG1-local-pick-v1","gameId":"32621","dbName":"sg_qhupwolfmountain96","runtimeGameId":33075,"runtimeSlug":"qhupwolfmountain96","ownSDKFileSHA256":"40fa65a4af877a9d1458330e4440a0be8cbecd0a0e77c4ac678dca066e61704d","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick","sourceProofSHA256":"a24b4a2e7cc1f2b12de5f1eac4bcc371f1a5ce37e8743764b9dab0879a4097f1","ownSourceHashes":{"ownFeatureStateFromActualCFGFTVFSFPM":"cddc746976f11623c7f885c064682af3d5d3f1ac8531f21ad879d780d4d95417","ownCreditValueFromOwnINITRBM":"4cf0a978ab7e10065170bdca134cf8a8613c17c6e8d1b72a4689cfee8a9f76ba","ownCreditMultiplierConversion":"7482b6966a205a673e7168be3ba3712ca9c00d00a0dce37a38fd5357bc4610ce","ownPaidBPRAndRBConstructor":"808bb070505af46e9b37482063e8d780feccb4b92391ef4fb40abb67abb275b8","ownPhysicalEnabledChoices":"fbf91dfbe268e3ee2a4e77f0229a763a30d3ee7576e104b3def9907e3883faf4","ownChoiceCountTwenty":"5a371e1d2aeaa5996fed8ee510a9fbd90af79ddb144b3d3c4b379f936a5d5bb7","ownPickCallbackWithLegalSlot":"106e5f00fdf21ab12c4aede0cf6cf583653306c4dbf4d15bd58de6e44e10df2d","ownCFRPendingDecoder":"fe585a5c196402e83faa63ce49e59dfb2fab8768a9dff46d0dac69450b515322","ownCFPPendingDecoder":"f8515b9e48252bbda18c1c0433006c2781d600d23fd8d99571a043767e92ff20","ownNFGDecoder":"3aab637a1f7447700d8df16b851e62d775b0f164ac3e51a0ad529ecfcfa3a6fd","ownGCTDecoder":"0362e5bad0beab587aaaebab71beaf6b576808dc5b31dd49449ca07db6ef4b4a","ownFTVDecoder":"5c126de25b2d256e7a5dee3047737d222f212008c8ab8080e5d363305487e628","ownFeatureRequestConstructor":"39e4229f9841176ed4e4de268fa7ff2db145e26c5dd3a74cabf4be95a0dabf9d","ownFeatureNextSelector":"f8158aef377d262f5f808722726cf98354e71bdcb35621983d1e1e404c2ba225"},"requestCFG":1,"sourceRoundFixed":1,"sourceLocalOrdinalPlusOne":true,"sourceChoiceDomain":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],"sourceUnconsumedChoiceOnly":true,"sourceTotalFromFTVFirstRowIndexOne":true,"featureEndIsNotSyntheticWholeEnd":true,"actualNaturalFeatureACKCoverage":0,"ordinaryWagerRaw":100,"unmappedNextEndStops":true},"32732":{"version":"own-QuickHit-Ultra-source-CFG1-local-pick-v1","gameId":"32732","dbName":"sg_qhultrapayseaglespeak","runtimeGameId":33132,"runtimeSlug":"qhultrapayseaglespeak","ownSDKFileSHA256":"935c93b053e3fa6afdead000fef8a2cd5b327dc69db407c3767a6c6020594dda","cfg":1,"ftvKey":"FTV_1","kind":"quickhit-single-round-pick","sourceProofSHA256":"c099e6d2398ce79f066e29162a2d01d8357b57131a77c80ed809b5e702fa9e7a","ownSourceHashes":{"ownFeatureStateFromActualCFGFTVFSFPM":"8a59a3c5150da25d2d146136c94f79cd300376878dbfb150c502f645d6eeb550","ownCreditValueFromOwnINITRBM":"6e5b420cfe9540fd0d8a3d629d5cee4e8f2f0689963ba9a06ea341ac3987f69c","ownCreditMultiplierConversion":"c23e966918057efec82da97d5c182f4a1ff75d6f04d0a17eb46118be1eb33e11","ownPaidBPRAndRBConstructor":"49df0998cbe9ca36a4c8ff005af172066cd47e24c6a4fc3b82ab80f62ff126d6","ownPhysicalEnabledChoices":"6e7820e9529234467b84bf3bea5a3f1010848308724b2e8b009c29fe9b0b0b0c","ownChoiceCountTwenty":"107d2be5e08926aa091d84fa6cf166e793f27b422a3e68f144cd8767e6a1af85","ownPickCallbackWithLegalSlot":"a1680f1072d66ffa4c6944c4d2ba92dbfd088188a2d71815187a8a1ba41b70e1","ownCFRPendingDecoder":"fc7c8e445ad69692cbbd2cd3eb6f4bf3b9c910c6efa3cc7531f0b4d49d6fc3da","ownCFPPendingDecoder":"5290d0a9a41115333c25e347faf9666a89f3a8964ca30042d089a3e7a8f017ab","ownNFGDecoder":"143f8663a417c32db643f67ea6719f16e6f575613c622ce31e4e1409705048c7","ownGCTDecoder":"2bf69cbaf2e6eea050b56d37400cf8938665f56956b9f86a4431881d4455703d","ownFTVDecoder":"9ff913812d1d2325a32538bc59354ed59883de25d7090875d4d8f8029d49d814","ownFeatureRequestConstructor":"5982da163b4794267c57786ade0caa845d038ed286c72ff3727cc5f610daccbc","ownFeatureNextSelector":"2481a33798c1a4a2389b61d75e5505a876d61efa7270985ab4c17debde1fa24f"},"requestCFG":1,"sourceRoundFixed":1,"sourceLocalOrdinalPlusOne":true,"sourceChoiceDomain":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],"sourceUnconsumedChoiceOnly":true,"sourceTotalFromFTVFirstRowIndexOne":true,"featureEndIsNotSyntheticWholeEnd":true,"actualNaturalFeatureACKCoverage":0,"ordinaryWagerRaw":100,"unmappedNextEndStops":true}});
const ownQuickHitUltraAccounts:Record<string,any>={"32620":{"version":"own-QuickHit-Ultra-source-credit-reels-v1","gameId":"32620","dbName":"sg_quickhitultrapaysmonkeysfortune96","runtimeGameId":33074,"runtimeSlug":"quickhitultrapaysmonkeysfortune96","ownSDKFileSHA256":"5707e28e37ec986dca44e81b5e1909bff34b55192a3f74678d2d9dd26d8c4723","SDKFinalGetterSourceSHA256":"bbbe72fedb7ce573d7d065d845990c567c36c1a29bb9b0f6bd404b00d04c6d17","sourceProofSHA256":"03bff9be6f19155f3e53c9b8512c0d82ae72b39f761e23c2db47afb94839958a","paidRequestParams":{"AP":"false","BPR":"5","GN":"quickhitultrapaysmonkeysfortune96","RB":"5"},"futureRequestParams":{"GN":"quickhitultrapaysmonkeysfortune96","BPR":"5","RB":"5"},"betRaw":100,"selectedAllowedBet":5,"selectedBetWireKey":"BPR","ownSelectedReels":5,"ownSelectedRBMMultiplier":20,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"ownUnmappedTerminalGSDKeys":[],"liveInitSelectedBetAndRBMMustMatchSource":true,"noDisplayCashOrCountEquations":true,"oldUnknownPOSTNeverReplayed":true},"32621":{"version":"own-QuickHit-Ultra-source-credit-reels-v1","gameId":"32621","dbName":"sg_qhupwolfmountain96","runtimeGameId":33075,"runtimeSlug":"qhupwolfmountain96","ownSDKFileSHA256":"40fa65a4af877a9d1458330e4440a0be8cbecd0a0e77c4ac678dca066e61704d","SDKFinalGetterSourceSHA256":"cc39116b0f76a6a4c4f08b7e843a1eb10cb14a63739816db8b63d1a228da2ca2","sourceProofSHA256":"a24b4a2e7cc1f2b12de5f1eac4bcc371f1a5ce37e8743764b9dab0879a4097f1","paidRequestParams":{"AP":"false","BPR":"5","GN":"qhupwolfmountain96","RB":"5"},"futureRequestParams":{"GN":"qhupwolfmountain96","BPR":"5","RB":"5"},"betRaw":100,"selectedAllowedBet":5,"selectedBetWireKey":"BPR","ownSelectedReels":5,"ownSelectedRBMMultiplier":20,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"ownUnmappedTerminalGSDKeys":[],"liveInitSelectedBetAndRBMMustMatchSource":true,"noDisplayCashOrCountEquations":true,"oldUnknownPOSTNeverReplayed":true},"32732":{"version":"own-QuickHit-Ultra-source-credit-reels-v1","gameId":"32732","dbName":"sg_qhultrapayseaglespeak","runtimeGameId":33132,"runtimeSlug":"qhultrapayseaglespeak","ownSDKFileSHA256":"935c93b053e3fa6afdead000fef8a2cd5b327dc69db407c3767a6c6020594dda","SDKFinalGetterSourceSHA256":"275d6a649b78f5a048bf31bd91c66ad2d4cddd414ed5a5a85a12d40ea0a48e4e","sourceProofSHA256":"c099e6d2398ce79f066e29162a2d01d8357b57131a77c80ed809b5e702fa9e7a","paidRequestParams":{"BPR":"5","GN":"qhultrapayseaglespeak","RB":"5"},"futureRequestParams":{"GN":"qhultrapayseaglespeak","BPR":"5","RB":"5"},"betRaw":100,"selectedAllowedBet":5,"selectedBetWireKey":"BPR","ownSelectedReels":5,"ownSelectedRBMMultiplier":20,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"ownUnmappedTerminalGSDKeys":[],"liveInitSelectedBetAndRBMMustMatchSource":true,"noDisplayCashOrCountEquations":true,"oldUnknownPOSTNeverReplayed":true}};
function ownQuickHitUltraAccountBinding(game:AGGameConfig){
 const c=game.sg.ownGDMContract,q=c.ownRootNFGFlowOnlyCapture,b=q?.ownQuickHitUltraAccountSelection;
 if(!b)return undefined;const expected=ownQuickHitUltraAccounts[game.gameId];
 assert(expected&&game.dbName===expected.dbName&&game.sg.runtimeGameId===expected.runtimeGameId&&game.sg.runtimeSlug===expected.runtimeSlug&&c.ownSDKFileSHA256===expected.ownSDKFileSHA256&&c.SDKFinalGetterSourceSHA256===expected.SDKFinalGetterSourceSHA256&&c.betRaw===100,'AG integrity: own Quick Hit Ultra source identity');
 assert.deepStrictEqual(b,expected,'AG integrity: own Quick Hit Ultra source account scope');
 assert.deepStrictEqual(game.sg.requestParams,expected.paidRequestParams,'AG integrity: own Quick Hit Ultra paid request');
 assert.deepStrictEqual(c.freeBudgetContract.freeRequestParams,expected.futureRequestParams,'AG integrity: own Quick Hit Ultra free request');
 return expected;
}
export type OwnNOVAFeatureState={
 cfg?:number;rawFTV?:string;counts?:number[];cfr?:number;cfp?:number;next?:OwnNOVAFeatureRequest;
 phase:'base'|'free'|'start'|'pick'|'end';ordinal:number;used:Set<number>;cap:boolean;
};
export function createOwnNOVAFeatureState():OwnNOVAFeatureState{return {phase:'base',ordinal:0,used:new Set(),cap:false};}
export function beginOwnNOVAFeatureRound(s:OwnNOVAFeatureState):void {
 assert(!s.next,'AG integrity: GDM own NOVA feature pending round');
 // featureData CFG/counts remain presence-updated like the client's object.
 s.phase='base';s.cap=false;
}
function number(value:string|undefined,label:string):number {
 assert(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'AG integrity: GDM own NOVA feature '+label);
 return Number(value);
}
function gsd(value:string|undefined):Record<string,string>{
 if(value===undefined)return {};
 const result:Record<string,string>={};
 for(const pair of value.split('#')){const at=pair.indexOf('~');assert(at>0&&!Object.prototype.hasOwnProperty.call(result,pair.slice(0,at)),'AG integrity: GDM own NOVA feature GSD');result[pair.slice(0,at)]=pair.slice(at+1);}
 return result;
}
function request(p:OwnNOVAFeatureProfile,event:string,extra:Record<string,string>={}):OwnNOVAFeatureRequest {
 return {event,parameters:{GN:p.runtimeSlug,...(event==='FREE_GAME'?{}:{CFG:String(p.cfg)}),...extra}};
}
function pick(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState):OwnNOVAFeatureRequest {
 assert(s.cfg===p.cfg,'AG integrity: GDM own NOVA feature selected CFG');
 if(p.kind==='rhino-wheel')return request(p,'FEATURE_PICK',{FP:`${s.ordinal}|0|0|`});
 const slot=Array.from({length:15},(_,i)=>i).find(i=>!s.used.has(i));
 assert(slot!==undefined,'AG integrity: GDM own Wild no source-enabled pick slot');
 return request(p,'FEATURE_PICK',{FP:`1|${s.ordinal+1}|${slot}|`});
}
function base(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,wire:Record<string,string>):OwnNOVAFeatureRequest|undefined {
 s.phase='base';
 // These flags are response-local. Old retained FTV is never a new trigger.
 if(wire.FGT!==undefined&&number(wire.FGT,'FGT')>0){s.phase='free';return request(p,'FREE_GAME');}
 const ftv=Object.keys(wire).filter(k=>/^FTV_[0-4]$/.test(k));
 if(!ftv.length)return undefined;
 assert(ftv.length===1&&ftv[0]===p.ftvKey&&s.cfg===p.cfg,'AG integrity: GDM own NOVA feature next unmapped');
 s.ordinal=0;s.used.clear();s.cap=false;s.phase='start';return request(p,'FEATURE_START');
}
// Draft SG protocol selectors only. Inputs here are source control fields,
// never manufactured provider XML, cash, NFG, feature ACKs or terminal ACKs.
export function isOwnBundleFeatureProfile(p:OwnNOVAFeatureProfile|undefined):boolean {
 return !!p&&['drums-two-round-cards','squid-bridge','quickhit-single-round-pick','linked-one-pick'].includes(p.kind);
}
function ownBundleInteger(value:string|undefined,label:string,signed=false):number {
 assert(typeof value==='string'&&(signed?/^-?\d+$/:/^\d+$/).test(value)&&Number.isSafeInteger(Number(value)),'AG integrity: GDM own bundle '+label);
 return Number(value);
}
function ownBundleBoolean(value:string|undefined):boolean|undefined {
 if(value===undefined)return undefined;
 // Both fixed clients use the original GDM Boolean decoder: finite numeric
 // values are truthy iff nonzero; textual literals are exactly source-defined.
 if(value.trim()!==''&&Number.isFinite(Number(value)))return Number(value)!==0;
 const lower=value.toLowerCase();
 if(['true','y','yes'].includes(lower))return true;
 if(['false','n','no'].includes(lower))return false;
 assert.fail('AG integrity: GDM own bundle Boolean selector unmapped');
}
function ownBundleFID(wire:Record<string,string>):number[] {
 if(wire.FID===undefined||wire.FID==='')return [];
 const values=wire.FID.split('|').filter(x=>x!=='');
 assert(values.length>0,'AG integrity: GDM own bundle empty FID');
 return values.map(x=>ownBundleInteger(x,'actual FID'));
}
function ownBundleFeatureRequest(p:OwnNOVAFeatureProfile,event:string,extra:Record<string,string>={}):OwnNOVAFeatureRequest {
 return {event,parameters:{GN:p.runtimeSlug,...(event==='FREE_GAME'?{}:{...(p.kind==='squid-bridge'?{BPL:'5'}:{}),CFG:String(p.cfg)}),...extra}};
}
function ownBundlePick(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState):OwnNOVAFeatureRequest {
 if(p.kind==='drums-two-round-cards'&&s.cfg!==undefined&&p.additionalModes?.includes(s.cfg))return ownBundleFeatureRequest(p,'FEATURE_PICK',{CFG:String(s.cfg),FP:'1|1|1'});
 assert(s.cfg===p.cfg,'AG integrity: GDM own bundle selected CFG');
 if(p.kind==='squid-bridge')return ownBundleFeatureRequest(p,'FEATURE_PICK',{FP:'0'});
 if(p.kind==='quickhit-single-round-pick'){
  assert(s.counts&&s.counts.length===1,'AG integrity: own Quick Hit Ultra actual pick total absent');
  const choice=Array.from({length:20},(_,i)=>i+1).find(i=>!s.used.has(i));
  assert(choice!==undefined,'AG integrity: own Quick Hit Ultra no enabled unconsumed choice');
  return ownBundleFeatureRequest(p,'FEATURE_PICK',{FP:`1|${s.ordinal+1}|${choice}`});
 }
 assert(p.kind==='drums-two-round-cards'&&s.counts&&s.counts.length>0&&s.counts.length<=2,'AG integrity: GDM own Dancing actual round counts absent');
 const first=s.counts[0],total=s.counts.reduce((a,b)=>a+b,0);
 assert(s.ordinal<total,'AG integrity: GDM own Dancing completed pick cursor');
 const choice=Array.from({length:12},(_,i)=>i).find(i=>!s.used.has(i));
 assert(choice!==undefined,'AG integrity: GDM own Dancing no source-enabled card');
 const round=s.ordinal<first?1:2,ordinal=s.ordinal<first?s.ordinal+1:s.ordinal-first+1;
 // Own nI + Infix serializer, not NOVA's postfix tuple.
 return ownBundleFeatureRequest(p,'FEATURE_PICK',{FP:`${round}|${ordinal}|${choice}`});
}
function ownDancingBase(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):OwnNOVAFeatureRequest|undefined {
 const fid=ownBundleFID(wire),values=gsd(wire.GSD);
 // Own PMa selects actual positive NFG after End even when FID is absent.
 if(p.endNextV3&&event==='FEATURE_END'&&fid.length===0&&wire.NFG!==undefined&&ownBundleInteger(wire.NFG,'actual ended free NFG',true)>0){
  if(ownBundleBoolean(wire.GCT)===true){s.phase='base';return undefined;}
  s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');
 }
 // Own coin End $Ia restores NFG into Na.lh and clears the network flag.
 // PMa then selects FREE_GAME from positive Na.lh, before retained FID/FTV.
 const ownEndedFree=p.endNextV3&&(fid[0]===2||p.endMode4V4&&fid[0]===4&&s.cfg===3)&&(
  event==='FEATURE_END'&&p.additionalModes?.includes(s.cfg as number)&&fid.slice(1).every(x=>x===s.cfg)
  ||event==='FREE_GAME'&&s.phase==='free');
 if(ownEndedFree){
  assert(wire.NFG!==undefined,'AG integrity: GDM own ended Dancing free remaining absent');
  const n=ownBundleInteger(wire.NFG,'actual ended free NFG');
  if(ownBundleBoolean(wire.GCT)===true||n===0){s.phase='base';return undefined;}
  s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');
 }
 if(p.additionalModes?.includes(s.cfg as number)&&(fid.includes(s.cfg as number)||event==='FEATURE_END')&&(fid.length===0||fid[0]===s.cfg)){
  if(ownBundleBoolean(wire.GCT)===true)return undefined;
  if(event!=='FEATURE_END'){s.ordinal=0;s.used.clear();s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START',{CFG:String(s.cfg)});}
  // Source coin End caller clears Vd.tk locally. Display FID/FTV is retained raw.
  if(wire.NFG!==undefined&&ownBundleInteger(wire.NFG,'actual NFG',true)===-1){assert(wire.CFGG!==undefined,'AG integrity: GDM own Dancing actual pending marker counter absent');if(ownBundleInteger(wire.CFGG,'actual CFGG')===0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}}
  s.phase='base';return undefined;
 }
 assert(fid.length===0||fid[0]===0,'AG integrity: GDM own Dancing actual other feature mode unmapped');
 if(ownBundleBoolean(wire.GCT)===true)return undefined;
 const ftv=Object.keys(wire).filter(k=>/^FTV_[0-4]$/.test(k));
 if(event!=='FEATURE_END'&&values.JP_WIN!==undefined){
  assert(s.cfg===0&&wire.FTV_0!==undefined&&ftv.length===1&&ftv[0]==='FTV_0','AG integrity: GDM own Dancing actual feature entry unmapped');
  const rows=wire.FTV_0.split('|').filter(x=>x!=='');
  assert(rows.length>0,'AG integrity: GDM own Dancing actual FTV counts absent');
  // P6a only consumes the first two rows; monetary/prize columns stay raw.
  s.counts=rows.slice(0,2).map(x=>ownBundleInteger(x.split(';')[1],'actual round pick count'));
  assert(s.counts.reduce((a,b)=>a+b,0)>0,'AG integrity: GDM own Dancing no source pick branch');
  s.ordinal=0;s.used.clear();s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START');
 }
 assert(ftv.length===0||event==='FEATURE_END'&&ftv.every(k=>k==='FTV_0'),'AG integrity: GDM own Dancing other actual feature entry unmapped');
 // Exact own response K0. Do not turn -1 into a provider NFG or normalize raw.
 if(wire.NFG!==undefined&&ownBundleInteger(wire.NFG,'actual NFG',true)===-1){
  assert(wire.CFGG!==undefined,'AG integrity: GDM own Dancing actual pending marker counter absent');
  if(ownBundleInteger(wire.CFGG,'actual CFGG')===0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}
 }
 s.phase='base';return undefined;
}
function ownSquidRedLightRequest(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,wire:Record<string,string>):OwnNOVAFeatureRequest {
 const values=gsd(wire.GSD),died=ownBundleBoolean(values.RLGL_DIED),won=ownBundleBoolean(values.RLGL_WON);
 if(died===true||won===true){s.phase='end';return ownBundleFeatureRequest(p,'FEATURE_END',{CFG:'1'});}
 // Explicit source-enabled choice 1. Only an actually present source step
 // participates in the client's 24-cell clamp; absence is not made zero.
 let chosen=1;
 if(values.RLGL_STEP!==undefined){const step=ownBundleInteger(values.RLGL_STEP,'actual RedLight path step');assert(step<=24,'AG integrity: GDM own RedLight source step outside path');if(24<chosen+step)chosen=24-step;}
 s.phase='pick';return ownBundleFeatureRequest(p,'FEATURE_PICK',{CFG:'1',FP:String(chosen)});
}
// Own Picker2 caller l5/Mg: START if not started; FP is the enabled UI
// index only; PICK_TYPE_WON presence chooses END. No prize/display math.
function ownSquidPickerRequest(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,wire:Record<string,string>,afterOwnStartOrPick=false):OwnNOVAFeatureRequest {
 assert(p.gameId==='32736'&&p.ownSDKFileSHA256==='2d3886a4aa6e2933676db592889674fa948a5b020321dc0594d2b18dbc3f352f'&&s.cfg===2,'AG integrity: GDM foreign own Picker caller');
 const values=gsd(wire.GSD);
 if(values.PICK_TYPE_WON!==undefined){s.phase='end';return ownBundleFeatureRequest(p,'FEATURE_END',{CFG:'2'});}
 if(!afterOwnStartOrPick&&ownBundleBoolean(wire.FS_2)!==true){s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START',{CFG:'2'});}
 // Own af/xwa explicitly supplies physical indexes 0..11 only when the
 // optional available vector is absent. A present empty vector stays empty.
 const available=values.AV_PICK_STEPS===undefined?Array.from({length:12},(_,i)=>i):values.AV_PICK_STEPS.split('|').filter(x=>x!=='').map(x=>ownBundleInteger(x,'actual Picker available index'));
 const chosen=Array.from({length:12},(_,i)=>i).find(i=>available.includes(i)&&!s.used.has(i));
 assert(chosen!==undefined,'AG integrity: GDM own Picker no source-enabled unconsumed index');
 s.phase='pick';return ownBundleFeatureRequest(p,'FEATURE_PICK',{CFG:'2',FP:String(chosen)});
}
function ownSquidBase(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):OwnNOVAFeatureRequest|undefined {
 const fid=ownBundleFID(wire);
 const ownMode=gsd(wire.GSD).FEATURE_ID;
 // Actual FEATURE_ID is the client's tXa driver: RedLight END can hand
 // off to Picker2 even while FID retains the ended RedLight1 marker.
 if(ownMode==='2'){
  if(ownBundleBoolean(wire.GCT)===true){s.phase='base';return undefined;}
  if(event==='FEATURE_END'&&s.cfg===2){
   // The own Picker xD returns Postplay after its acknowledged END.
   // Its result-presence selector and tD local close do not clear raw FID.
   // A remaining-free response still follows the existing FREE path below.
   if(gsd(wire.GSD).PICK_TYPE_WON===undefined)assert(fid.length===0,'AG integrity: GDM own Picker still-pending next after actual END unmapped');
   assert(wire.NFG!==undefined,'AG integrity: GDM own Picker actual end remaining absent');
   if(ownBundleInteger(wire.NFG,'actual Picker end NFG')>0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}
   s.phase='base';return undefined;
  }
  if(s.cfg!==2){s.ordinal=0;s.used.clear();}s.cfg=2;
  return ownSquidPickerRequest(p,s,wire);
 }
 if(p.additionalModes?.includes(1)&&(fid.includes(1)||event==='FEATURE_END'&&s.cfg===1)){
  assert(fid.length===0||fid[0]===1,'AG integrity: GDM own RedLight combined source mode unmapped');
  if(ownBundleBoolean(wire.GCT)===true)return undefined;
  if(event==='FEATURE_END'){const remaining=wire.NFG===undefined?undefined:ownBundleInteger(wire.NFG,'actual NFG');if(remaining!==undefined&&remaining>0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}s.phase='base';return undefined;}
  assert(ownMode==='1','AG integrity: GDM own RedLight actual FEATURE_ID absent');s.cfg=1;s.ordinal=0;s.used.clear();
  if(ownBundleBoolean(wire.FS_1)===true)return ownSquidRedLightRequest(p,s,wire);
  s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START',{CFG:'1'});
 }
 // Own TugOfWar is local animation; Sua/W5 sends no feature request args.
 // Actual Ge>0 chooses generic FREE_GAME; Tug tD/JH closes at zero or GCT.
 if(p.tugOfWarV4&&(ownMode==='0'||fid.includes(0)||s.cfg===0&&s.phase==='free')){
  assert(fid.every(x=>x===0),'AG integrity: GDM own Tug combined source mode unmapped');
  assert(ownMode==='0'||ownMode===undefined&&s.cfg===0&&s.phase==='free'&&event==='FREE_GAME','AG integrity: GDM own Tug actual context absent');
  assert(event==='BET'||event==='FREE_GAME','AG integrity: GDM own Tug actual response event unmapped');
  s.cfg=0;
  if(ownBundleBoolean(wire.GCT)===true){s.phase='base';return undefined;}
  assert(wire.NFG!==undefined,'AG integrity: GDM own Tug actual remaining absent');
  const n=ownBundleInteger(wire.NFG,'actual Tug NFG');
  if(n===0){s.phase='base';return undefined;}
  s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');
 }
 assert(fid.every(x=>x===3||x===4),'AG integrity: GDM own Squid actual other feature mode unmapped');
 if(ownBundleBoolean(wire.GCT)===true)return undefined;
 const remaining=wire.NFG===undefined?0:ownBundleInteger(wire.NFG,'actual NFG');
 const values=gsd(wire.GSD);
 const actualMode=values.FEATURE_ID===undefined?undefined:ownBundleInteger(values.FEATURE_ID,'actual GSD FEATURE_ID');
 // After the own Bridge End, FEATURE_ID4/NFG is the current Free response.
 // A retained FID3 does not send another Bridge START; Ge>0 selects FREE_GAME.
 if(p.endNextV3&&actualMode===4&&fid.includes(4)&&s.cfg===3&&(
  event==='FEATURE_END'||event==='FREE_GAME'&&s.phase==='free')){
  assert(wire.NFG!==undefined,'AG integrity: GDM own ended Bridge free remaining absent');
  const n=ownBundleInteger(wire.NFG,'actual ended Bridge free NFG');
  if(n===0){s.phase='base';return undefined;}
  s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');
 }
 assert(actualMode===undefined||actualMode===3||actualMode===4,'AG integrity: GDM own Squid other actual GSD feature mode unmapped');
 if(fid.includes(3)){
  assert(event==='BET'||event==='FREE_GAME','AG integrity: GDM own Squid unresolved Bridge after actual end');
  assert(actualMode===3||actualMode===4,'AG integrity: GDM own Squid actual Bridge source mode absent');
  // tXa routes FEATURE_ID4 with current FID3 back through the Bridge3 caller.
  // The request CFG is context.$b, never a copied response CFG/display value.
  s.cfg=3;
  assert(values.BRIDGE_STEP===undefined||ownBundleInteger(values.BRIDGE_STEP,'actual bridge step')===0,'AG integrity: GDM own Squid recovered Bridge not admitted');
  s.ordinal=0;s.used.clear();s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START');
 }
 if(remaining>0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}
 // Source BridgeFreeSpins.tD -> BaseIdle Ready2 -> platform ROUND Stopped0.
 // FID4 remains in the original packet; no extra GDM request or fake ACK.
 if(fid.includes(4)||actualMode===4){
  assert((event==='FREE_GAME'||event==='FEATURE_PICK'||event==='FEATURE_END')&&actualMode===4,'AG integrity: GDM own Squid BridgeFreeSpins terminal context unmapped');
  s.phase='base';return undefined;
 }
 assert(actualMode!==3||event==='FEATURE_END','AG integrity: GDM own Squid unresolved actual Bridge source mode');
 s.phase='base';return undefined;
}
function ownQuickHitUltraBase(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):OwnNOVAFeatureRequest|undefined {
 const modes=ownBundleFID(wire);assert(modes.every(x=>x===0||x===1),'AG integrity: own Quick Hit Ultra unmapped mode');
 if(ownBundleBoolean(wire.GCT)===true){s.phase='base';return undefined;}
 const cfg=wire.CFG===undefined?undefined:ownBundleInteger(wire.CFG,'own Ultra CFG');
 const remaining=wire.NFG===undefined?0:ownBundleInteger(wire.NFG,'own Ultra NFG');
 const cfr=wire.CFR_1===undefined?undefined:ownBundleInteger(wire.CFR_1,'own Ultra CFR1',true);
 const cfp=wire.CFP_1===undefined?undefined:ownBundleInteger(wire.CFP_1,'own Ultra CFP1',true);
 if(cfg===1&&cfr===0&&cfp===0){
  assert(event!=='FEATURE_END','AG integrity: own Ultra unresolved feature after actual end');
  assert(wire.FTV_1!==undefined,'AG integrity: own Ultra actual FTV1 pick total absent');
  const row=wire.FTV_1.split('|').filter(x=>x!=='')[0];assert(row!==undefined,'AG integrity: own Ultra actual first FTV row absent');
  const total=ownBundleInteger(row.split(';')[1],'own Ultra source total picks');assert(total<=20,'AG integrity: own Ultra pick total exceeds own physical choices');
  s.cfg=1;s.counts=[total];s.ordinal=0;s.used.clear();s.phase='start';return ownBundleFeatureRequest(p,'FEATURE_START');
 }
 if(remaining>0){s.phase='free';return ownBundleFeatureRequest(p,'FREE_GAME');}
 assert(cfg===undefined||cfg===0||cfg===1,'AG integrity: own Ultra other current CFG unmapped');
 s.phase='base';return undefined;
}
function updateOwnQuickHitUltraNext(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):void {
 if(wire.GCT!==undefined)ownBundleBoolean(wire.GCT);
 if(event==='BET'||event==='FREE_GAME'){s.next=ownQuickHitUltraBase(p,s,event,wire);return;}
 assert(s.next?.event===event,'AG integrity: own Quick Hit Ultra actual response stage');
 if(ownBundleBoolean(wire.GCT)===true){s.phase='base';s.next=undefined;return;}
 if(wire.CFG!==undefined)assert(ownBundleInteger(wire.CFG,'own Ultra response CFG')===1,'AG integrity: own Ultra feature CFG changed');
 if(wire.FTV_1!==undefined){const row=wire.FTV_1.split('|').filter(x=>x!=='')[0];assert(row!==undefined,'AG integrity: own Ultra actual first FTV row absent');const total=ownBundleInteger(row.split(';')[1],'own Ultra source total picks');assert(total<=20,'AG integrity: own Ultra pick total exceeds own choices');s.counts=[total];}
 if(event==='FEATURE_START'||event==='FEATURE_PICK'){
  assert(s.counts&&s.counts.length===1&&s.cfg===1,'AG integrity: own Ultra current feature total absent');
  if(event==='FEATURE_PICK'){const choice=ownBundleInteger(s.next.parameters.FP.split('|')[2],'own Ultra emitted choice');assert(choice>=1&&choice<=20&&!s.used.has(choice),'AG integrity: own Ultra illegal consumed choice');s.used.add(choice);s.ordinal+=1;}
  if(s.ordinal<s.counts[0]){s.phase='pick';s.next=ownBundlePick(p,s);}else{s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END');}
  return;
 }
 assert(event==='FEATURE_END','AG integrity: own Ultra actual event unmapped');s.next=ownQuickHitUltraBase(p,s,event,wire);
}
export function updateOwnBundleFeatureNext(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):void {
 assert(isOwnBundleFeatureProfile(p),'AG integrity: GDM own bundle source profile');
 if(p.kind==='quickhit-single-round-pick'){updateOwnQuickHitUltraNext(p,s,event,wire);return;}
 if(wire.GCT!==undefined)ownBundleBoolean(wire.GCT);
 // END acknowledges the emitted request's CFG; its response can introduce
 // another already-bound coin mode. Keep that association before adopting CFG.
 if(p.kind==='drums-two-round-cards'&&event==='FEATURE_END'&&wire.CFG!==undefined){
  const endedCFG=ownBundleInteger(s.next?.parameters.CFG,'emitted own FEATURE_END CFG');
  const nextCFG=ownBundleInteger(wire.CFG,'actual CFG'),fid=ownBundleFID(wire);
  if(nextCFG!==endedCFG&&p.additionalModes?.includes(nextCFG)&&fid[0]===nextCFG){
   assert(s.next?.event===event&&(endedCFG===p.cfg||p.additionalModes.includes(endedCFG)),'AG integrity: GDM own Dancing END request mode association');
   if(ownBundleBoolean(wire.GCT)===true){s.phase='base';s.next=undefined;return;}
   assert(ownBundleBoolean(wire.IFG)===false&&ownBundleBoolean(wire[`FS_${nextCFG}`])===false,'AG integrity: GDM own Dancing handed-off mode already active or unstarted status unmapped');
   s.cfg=nextCFG;s.ordinal=0;s.used.clear();s.phase='start';s.next=ownBundleFeatureRequest(p,'FEATURE_START',{CFG:String(nextCFG)});return;
  }
 }
 if(p.kind==='drums-two-round-cards'&&wire.CFG!==undefined&&!(event==='FEATURE_END'&&p.additionalModes?.includes(s.cfg as number)))s.cfg=ownBundleInteger(wire.CFG,'actual CFG');
 if(event==='BET'||event==='FREE_GAME'){
  s.next=p.kind==='drums-two-round-cards'?ownDancingBase(p,s,event,wire):ownSquidBase(p,s,event,wire);return;
 }
 assert(s.next?.event===event,'AG integrity: GDM own bundle actual source response stage');
 if(event==='FEATURE_START'){
  if(p.kind==='squid-bridge'&&s.cfg===2){s.next=ownSquidPickerRequest(p,s,wire,true);return;}
  if(p.kind==='squid-bridge'&&s.cfg===1&&p.additionalModes?.includes(1)){s.next=ownSquidRedLightRequest(p,s,wire);return;}
  assert(s.cfg===p.cfg||p.kind==='drums-two-round-cards'&&p.additionalModes?.includes(s.cfg as number),'AG integrity: GDM own bundle actual FEATURE_START CFG');
  s.phase='pick';s.next=ownBundlePick(p,s);return;
 }
 if(event==='FEATURE_PICK'){
  if(p.kind==='squid-bridge'&&s.cfg===2){const chosen=ownBundleInteger(s.next.parameters.FP,'own emitted Picker index');assert(chosen<12&&!s.used.has(chosen),'AG integrity: GDM own Picker emitted index not enabled');s.used.add(chosen);s.ordinal+=1;s.next=ownSquidPickerRequest(p,s,wire,true);return;}
  if(p.kind==='squid-bridge'&&s.cfg===1&&p.additionalModes?.includes(1)){s.ordinal+=1;s.next=ownSquidRedLightRequest(p,s,wire);return;}
  if(p.kind==='drums-two-round-cards'&&s.cfg!==undefined&&p.additionalModes?.includes(s.cfg)){s.ordinal+=1;s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END',{CFG:String(s.cfg)});return;}
  if(p.kind==='drums-two-round-cards'){
   s.used.add(ownBundleInteger(s.next.parameters.FP.split('|')[2],'emitted own card'));
   s.ordinal+=1;assert(s.counts,'AG integrity: GDM own Dancing current source pick counts');
   if(s.ordinal<s.counts.reduce((a,b)=>a+b,0)){s.phase='pick';s.next=ownBundlePick(p,s);}
   else{s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END');}
  }else{
   const survived=ownBundleBoolean(gsd(wire.GSD).BRIDGE_SURVIVED);
   if(survived===undefined){s.phase='pick';s.next=ownBundlePick(p,s);}
   else if(ownBundleFID(wire).includes(4))s.next=ownSquidBase(p,s,event,wire);
   else{s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END');}
  }
  return;
 }
 assert(event==='FEATURE_END','AG integrity: GDM own bundle actual event unmapped');
 s.next=p.kind==='drums-two-round-cards'?ownDancingBase(p,s,event,wire):ownSquidBase(p,s,event,wire);
}

// Only own32706: its EndWinRendering picker transition precedes EndPlay/free.
// The later spin request selector accepts truthy remaining, including -1.
function updateOwnLinkHighLimitNext(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):void {
 assert(p.gameId==='32706'&&p.ownSDKFileSHA256==='67b38f1aa0eeac5c304443f8200e0cdc32ceaa27d613f3f8c24834696f295f85','AG integrity: own32706 next scope');
 const selectedNumber=(value:string|undefined,label:string):number=>{assert(typeof value==='string'&&/^-?\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'AG integrity: own32706 '+label);return Number(value);};
 const firstFID=wire.FID===undefined||wire.FID===''?undefined:selectedNumber(wire.FID.split('|')[0],'actual first FID');
 assert(firstFID===undefined||firstFID===0||firstFID===1,'AG integrity: own32706 actual next unmapped');
 const fs=ownBundleBoolean(wire.FS_1),gct=ownBundleBoolean(wire.GCT),active=event!=='FEATURE_END'&&(firstFID===1||['start','pick','end'].includes(s.phase));
 assert(!(gct===true&&active),'AG integrity: own32706 terminal dispatch unmapped');
 if(gct===true){s.phase='base';s.next=undefined;return;}
 if(active){
  const values=wire.GSD===undefined?{}:ownGDMFields(wire.GSD,'#','~'),vpc=values.VPC===undefined?undefined:selectedNumber(values.VPC,'actual VPC');
  const picked=event==='FEATURE_PICK'||s.phase==='end'||vpc!==undefined&&!!vpc,started=event==='FEATURE_START'||s.phase==='pick'||s.phase==='end'||fs===true;
  if(picked){s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END');}
  else if(started){s.phase='pick';s.next=ownBundleFeatureRequest(p,'FEATURE_PICK',{FP:'1|1|0'});}
  else{s.phase='start';s.next=ownBundleFeatureRequest(p,'FEATURE_START');}return;
 }
 const remaining=wire.NFG===undefined?0:selectedNumber(wire.NFG,'actual NFG');
 // Actual FeatureEnd success clears picker.isTriggered before this selector.
 // No invented NFG/end: nonzero includes the client's unlimited -1.
 if(remaining!==0){s.phase='free';s.next=ownBundleFeatureRequest(p,'FREE_GAME');return;}
 assert(fs!==false,'AG integrity: own32706 pending next unmapped');s.phase='base';s.next=undefined;
}

// Source ACK-local transitions belong to this one picker, never a provider End ACK.
function updateOwnLinkedPickerNext(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):void {
 assert(p.kind==='linked-one-pick'&&ownLinkedPickerProfiles[p.gameId]?.ownSDKFileSHA256===p.ownSDKFileSHA256,'AG integrity: own linked picker update scope');
 if(p.gameId==='32706'){updateOwnLinkHighLimitNext(p,s,event,wire);return;}
 const firstFID=wire.FID===undefined||wire.FID===''?undefined:ownBundleInteger(wire.FID.split('|')[0],'linked picker actual first FID');
 assert(firstFID===undefined||firstFID===0||firstFID===1,'AG integrity: own linked picker actual next unmapped');
 const fs=ownBundleBoolean(wire.FS_1),gct=ownBundleBoolean(wire.GCT);
 const active=event!=='FEATURE_END'&&(firstFID===1||['start','pick','end'].includes(s.phase));
 // Getter and local picker callers are both authenticated; their conflicting
 // global dispatch order is not. Preserve that actual combination as unknown.
 assert(!(gct===true&&active),'AG integrity: own linked picker terminal dispatch unmapped');
 if(gct===true){s.phase='base';s.next=undefined;return;}
 if(active){
  const values=wire.GSD===undefined?{}:ownGDMFields(wire.GSD,'#','~'),vpc=values.VPC===undefined?undefined:ownBundleInteger(values.VPC,'linked picker actual VPC',true);
  const picked=event==='FEATURE_PICK'||s.phase==='end'||vpc!==undefined&&vpc!==0,started=event==='FEATURE_START'||s.phase==='pick'||s.phase==='end'||fs===true;
  if(picked){s.phase='end';s.next=ownBundleFeatureRequest(p,'FEATURE_END');}
  else if(started){s.phase='pick';s.next=ownBundleFeatureRequest(p,'FEATURE_PICK',{FP:'1|1|0'});}
  else{s.phase='start';s.next=ownBundleFeatureRequest(p,'FEATURE_START');}return;
 }
 const remaining=wire.NFG===undefined?0:ownBundleInteger(wire.NFG,'linked picker actual NFG',true);
 if(remaining>0){s.phase='free';s.next=ownBundleFeatureRequest(p,'FREE_GAME');return;}
 assert(fs!==false,'AG integrity: own linked picker pending next unmapped');s.phase='base';s.next=undefined;
}

/** Source-selector inputs only; this function never manufactures wire fields. */
export function updateOwnNOVAFeatureNext(p:OwnNOVAFeatureProfile,s:OwnNOVAFeatureState,event:string,wire:Record<string,string>):void {
 if(p.kind==='linked-one-pick'){updateOwnLinkedPickerNext(p,s,event,wire);return;}
 if(isOwnBundleFeatureProfile(p)){updateOwnBundleFeatureNext(p,s,event,wire);return;}
 if(wire.CFG!==undefined)s.cfg=number(wire.CFG,'CFG');
 if(wire[p.ftvKey]!==undefined)s.rawFTV=wire[p.ftvKey];
 if(p.kind==='rhino-wheel'){
  if(wire.CFR_0!==undefined)s.cfr=number(wire.CFR_0,'CFR');
  if(wire.CFP_0!==undefined)s.cfp=number(wire.CFP_0,'CFP');
 }
 if(event==='BET'){s.next=base(p,s,wire);return;}
 if(event==='FREE_GAME'){
  if(number(wire.NFG,'NFG')>0){s.phase='free';s.next=request(p,'FREE_GAME');}
  else s.next=base(p,s,wire);
  return;
 }
 assert(s.next?.event===event&&s.cfg===p.cfg,'AG integrity: GDM own NOVA feature response stage');
 if(event==='FEATURE_START'){s.phase='pick';s.next=pick(p,s);return;}
 if(event==='FEATURE_PICK'){
  const emitted=s.next.parameters.FP;
  if(p.kind==='wild-grid')s.used.add(number(emitted.split('|')[2],'emitted slot'));
  s.ordinal+=1;
  const values=gsd(wire.GSD);
  let more:boolean;
  if(p.kind==='rhino-wheel'){
   if(values.CAPS!==undefined&&Number(values.CAPS)>0)s.cap=true;
   // Source featureData starts undefined; absent fields are not made zero.
   let ownRoundCount:number|undefined;
   if(s.cfr!==undefined&&s.cfp!==undefined&&s.rawFTV!==undefined){const rounds=s.rawFTV.split('|').filter(v=>v!=='');const round=rounds[s.cfr-1];if(round!==undefined){ownRoundCount=number(round.split(';')[1],'actual used FTV pick count');}}
   more=(s.cfp as number)<=ownRoundCount&&!s.cap;
  }else{
   // The own source uses current parseInt(MPR)>0; absence is its false branch.
   more=parseInt(values.MPR)>0;
  }
  if(more){s.phase='pick';s.next=pick(p,s);}
  else if(p.kind==='rhino-wheel'&&s.cap){s.cap=false;s.next=base(p,s,wire);}
  else{s.phase='end';s.next=request(p,'FEATURE_END');}
  return;
 }
 assert(event==='FEATURE_END','AG integrity: GDM own NOVA feature event unmapped');
 s.next=base(p,s,wire);
}
/** Pure getter. Reading a request cannot increment FP or consume a slot. */
export function getOwnNOVAFeatureNext(s:OwnNOVAFeatureState,freeParams:Record<string,string>):OwnNOVAFeatureRequest|undefined {
 if(!s.next)return undefined;
 return {event:s.next.event,parameters:s.next.event==='FREE_GAME'?{...freeParams}:{...s.next.parameters}};
}

// SG transport evidence mapped into the unchanged original AG error policy.
// This file never retries a request or changes AG scheduling/round handling.
export type SGFaultCategory = 'recoverable-initialization' | 'protocol' | 'execution-unknown';
export type SGRequestKind = 'initialization' | 'round-start' | 'round-follow-up';
export interface SGRequestEvidence {
    event: string;
    requestKind: SGRequestKind;
    gameplayRequestHasBeenSent: boolean;
    httpStatus?: number;
    ordinal: number;
    responseSHA256?: string;
}

export class SGSourceFault extends Error {
    readonly executionUncertain: boolean;
    readonly retryAction: 'original-ag-new-session' | 'stop-preserve-evidence';
    constructor(readonly category: SGFaultCategory, readonly evidence: Readonly<SGRequestEvidence>) {
        // Original AG treats the exact AG integrity prefix as deterministic.
        // Only an untouched Init session is allowed into its finite retry path.
        const prefix = category === 'recoverable-initialization' ? 'SG initialization temporarily unavailable' : 'AG integrity: SG ' + category;
        super(prefix + ' ' + JSON.stringify({ event: evidence.event, requestKind: evidence.requestKind,
            httpStatus: evidence.httpStatus, ordinal: evidence.ordinal }));
        this.name = 'SGSourceFault';
        this.executionUncertain = category === 'execution-unknown';
        this.retryAction = category === 'recoverable-initialization' ? 'original-ag-new-session' : 'stop-preserve-evidence';
        this.evidence = Object.freeze({ ...evidence });
    }
}

export class SGClosedFreeSessionDiscard extends AGDiscardedRoundError {
    readonly executionUncertain=true;
    readonly oldRequestMayHaveExecuted=true;
    readonly oldRequestReplays=0;
    readonly retryAction='original-ag-discard-then-new-free-session';
    constructor(readonly originalFault:SGSourceFault) {
        super(originalFault.evidence.event);
        this.name='SGClosedFreeSessionDiscard';
        // Do not claim an error-only response or that the old wager failed.
        this.message='SG uncertain Free round sealed; discard and create a new Free session for future samples';
    }
}

const transientInitStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
function untouchedInit(evidence: SGRequestEvidence): boolean {
    return evidence.event === 'Init' && evidence.requestKind === 'initialization'
        && evidence.ordinal === 1 && evidence.gameplayRequestHasBeenSent === false;
}

export function httpSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    if (!Number.isInteger(evidence.httpStatus) || evidence.httpStatus! < 100 || evidence.httpStatus! > 599
        || (evidence.httpStatus! >= 200 && evidence.httpStatus! < 300)) {
        throw new Error('AG integrity: SG invalid HTTP fault evidence');
    }
    if (untouchedInit(evidence)) {
        return new SGSourceFault(transientInitStatuses.has(evidence.httpStatus!) ? 'recoverable-initialization' : 'protocol', evidence);
    }
    // HTTP status/body alone cannot prove a wager, feature or EndGame was not
    // applied. Keep the request outcome uncertain; never re-send this POST.
    return new SGSourceFault('execution-unknown', evidence);
}

export function transportSourceFault(evidence: SGRequestEvidence): SGSourceFault {
    return new SGSourceFault(untouchedInit(evidence) ? 'recoverable-initialization' : 'execution-unknown', evidence);
}

export function sourceFaultMetadata(fault: SGSourceFault) {
    return { faultCategory: fault.category, requestKind: fault.evidence.requestKind,
        executionUncertain: fault.executionUncertain, retryAction: fault.retryAction,
        ...(fault.evidence.responseSHA256 ? { responseSHA256: fault.evidence.responseSHA256 } : {}) };
}


type WireStep = {msgId: string; requestPayload: string; responsePayload: string; responseBalance?: number; elapsedMs?: number; httpStatus?: number};
type WireTransport = (event: string, payload: string) => Promise<WireStep>;

export type Own32769OriginalInitFrame = Readonly<{
    kind: 'original-ag-live-Init-wire-DATA-only';
    sessionScope: SGWmsSession;
    game: AGGameConfig;
    step: WireStep;
    msgId: 'Init';
    requestPayload: string;
    responsePayload: string;
    endpoint: string;
    ordinal: number;
    initialSessionID: string;
    httpStatus: number;
    responseHeaders: Headers;
    response: Response;
    nativeGameID: string;
    gameCodeRGI: string;
    nativeVersionID: string;
    runtimeGameId: unknown;
}>;
export type Own32769InitSource = Readonly<{
    read(session: object): Own32769OriginalInitFrame;
    has(frame: unknown): boolean;
}>;
type Own32769InitConsumer = (
    session: SGWmsSession, source: Own32769InitSource
) => unknown | Promise<unknown>;

const own32769LiveInitByStep =
    new WeakMap<WireStep, Own32769OriginalInitFrame>();
const own32769PendingInit =
    new WeakMap<object, Own32769OriginalInitFrame>();
const own32769ValidatedInit =
    new WeakMap<object, Own32769OriginalInitFrame>();
const own32769IssuedInit = new WeakSet<object>();
let own32769InitConsumer: Own32769InitConsumer | undefined;
const own32769ConsumedInitData = new WeakMap<object, unknown>();

export const own32769OriginalInitSource: Own32769InitSource = Object.freeze({
    read(session: object) {
        const frame = own32769ValidatedInit.get(session);
        assert(frame, 'AG integrity: own32769 no validated original Init frame');
        return frame;
    },
    has(value: unknown) {
        return typeof value === 'object' && value !== null
            && own32769IssuedInit.has(value)
            && own32769ValidatedInit.get(
                (value as Own32769OriginalInitFrame).sessionScope
            ) === value;
    }
});
function own32769SourceDuringConsumption(session: SGWmsSession): Own32769InitSource {
    return Object.freeze({
        read(requested: object) {
            assert(requested === session, 'AG integrity: own32769 Init scope');
            const frame = own32769PendingInit.get(session)
                || own32769ValidatedInit.get(session);
            assert(frame, 'AG integrity: own32769 Init frame revoked');
            return frame;
        },
        has(value: unknown) {
            return typeof value === 'object' && value !== null
                && own32769IssuedInit.has(value)
                && (value as Own32769OriginalInitFrame).sessionScope === session
                && (own32769PendingInit.get(session) === value
                    || own32769ValidatedInit.get(session) === value);
        }
    });
}
export function bindOwn32769InitDataFactory(
    consumer: Own32769InitConsumer
) {
    assert(typeof consumer === 'function',
        'AG integrity: own32769 private Init consumer binding');
    own32769InitConsumer = consumer;
    return () => {
        if (own32769InitConsumer === consumer) own32769InitConsumer = undefined;
    };
}
export function readOwn32769ConsumedInitData(session: object): unknown {
    assert(own32769ValidatedInit.has(session)
        && own32769ConsumedInitData.has(session),
        'AG integrity: own32769 Init DATA not consumed');
    return own32769ConsumedInitData.get(session);
}


type Own32777NativeSlot = {
    game: AGGameConfig;
    open: boolean;
    init?: any;
    current?: any;
    connection?: any;
    inFlight?: any;
    roundScope?: object;
    lastOrdinal: number;
};
const own32777NativeSlots = new WeakMap<object, Own32777NativeSlot>();
const own32777NativeStarted = new WeakSet<object>();
const own32777NativeIssued = new WeakSet<object>();
const own32777NativeUsedDispatches = new WeakSet<object>();
const own32777NativeRawByStep = new WeakMap<object, any>();
const own32777NativeCleanupFailure = new WeakMap<object, unknown>();

type Own32777AGRoundIntentSlot = {cap: any; phase: 'offered' | 'consumed'; ordinal: number};
type Own32777AGRoundBinding = Readonly<{admissionFrame: any; previousRoundScope: object | null}>;
const own32777OriginalAGRoundIntents = new WeakMap<object, Own32777AGRoundIntentSlot>();
const own32777OriginalAGRoundBindings = new WeakMap<object, Own32777AGRoundBinding>();
const own32777RetiredAGRoundIntents = new WeakSet<object>();
function own32777IssueOriginalAGPaidIntent(
    session: object, originalAction: string, originalCurrentSessionID: string
) {
    const slot = own32777NativeSlot(session);
    assert(originalAction === 'SPIN' && slot.init && slot.connection && !slot.inFlight,
        'AG integrity: own32777 original AG paid admission requires no in-flight request');
    const admission = slot.connection.readOriginalAGPaidAdmission();
    const previous = own32777OriginalAGRoundIntents.get(session);
    assert(admission && Number.isSafeInteger(admission.startCashRaw) &&
        admission.startCashRaw >= slot.game.sg.betRaw &&
        Number.isSafeInteger(admission.nextRoundOrdinal) &&
        admission.nextRoundOrdinal > 0 && Number.isSafeInteger(admission.remainingPaidRounds) &&
        admission.remainingPaidRounds > 0 && admission.InitAdoptions === 1 &&
        admission.accountScope && typeof admission.accountScope === 'object' &&
        typeof originalCurrentSessionID === 'string' && originalCurrentSessionID.length > 0 &&
        admission.requestSessionID === originalCurrentSessionID,
        'AG integrity: own32777 current native initialized account admission');
    if (previous) {
        const frame = slot.current;
        assert(previous.phase === 'consumed' && admission.phase === 'round-closed' &&
            admission.actualPriorEndACK === true && admission.nativeProtocolIdle === true &&
            frame && frame.msgId === 'EndGame' && own32777NativeIssued.has(frame) &&
            frame.sessionScope === session && frame.game === slot.game &&
            frame.roundScope === slot.roundScope && slot.roundScope === previous.cap &&
            frame === admission.admissionFrame && frame.cashRaw === admission.startCashRaw &&
            frame.responseSessionID === originalCurrentSessionID &&
            admission.previousRoundScope === previous.cap &&
            admission.accountScope === previous.cap.accountScope &&
            admission.nextRoundOrdinal === previous.ordinal + 1,
            'AG integrity: own32777 next paid requires genuine current End ACK and protocol IDLE');
    } else {
        assert(!slot.current && !slot.roundScope && admission.phase === 'init' &&
            admission.admissionFrame === slot.init &&
            admission.previousRoundScope === null && admission.nextRoundOrdinal === 1 &&
            admission.startCashRaw === slot.init.cashRaw &&
            slot.init.responseSessionID === originalCurrentSessionID,
            'AG integrity: own32777 first paid requires actual adopted original Init');
    }
    const cap = Object.freeze({
        kind:'original-AG-owned-new-paid-round-DATA',
        sessionScope:session,sourceInitFrame:slot.init,game:slot.game,
        accountScope:admission.accountScope,startCashRaw:admission.startCashRaw,
        requestSessionID:admission.requestSessionID,roundOrdinal:admission.nextRoundOrdinal
    });
    if (previous) own32777RetiredAGRoundIntents.add(previous.cap);
    own32777OriginalAGRoundIntents.set(session,{cap,phase:'offered',ordinal:admission.nextRoundOrdinal});
    own32777OriginalAGRoundBindings.set(cap,Object.freeze({
        admissionFrame:admission.admissionFrame,
        previousRoundScope:admission.previousRoundScope
    }));
    return cap;
}
function own32777HasOriginalAGPaidIntent(session: object, cap: any) {
    const slot = own32777NativeSlots.get(session);
    const row = own32777OriginalAGRoundIntents.get(session);
    return !!slot?.open && !!slot.init && row?.cap === cap &&
        !own32777RetiredAGRoundIntents.has(cap) &&
        cap?.sessionScope === session && cap?.game === slot.game &&
        cap?.sourceInitFrame === slot.init && cap?.roundOrdinal === row.ordinal;
}
function own32777ReadOriginalAGPaidIntent(session: object, cap: any) {
    assert(own32777HasOriginalAGPaidIntent(session,cap),
        'AG integrity: own32777 current original AG cap binding');
    const binding = own32777OriginalAGRoundBindings.get(cap);
    assert(binding,'AG integrity: own32777 paid admission binding already dispatched');
    return binding;
}
function own32777ConsumeOriginalAGPaidIntent(session: object, cap: any) {
    const binding = own32777ReadOriginalAGPaidIntent(session,cap);
    const row = own32777OriginalAGRoundIntents.get(session)!;
    assert(row.phase === 'offered' && binding,
        'AG integrity: own32777 original AG round intent already consumed');
    row.phase = 'consumed';
}


function own32777AssertGame(game: AGGameConfig) {
    assert(game.provider === 'sg' && game.gameId === '32777' &&
        game.dbName === 'sg_jjbxmegaways' &&
        game.sg?.protocol === 'wms' && game.sg.betRaw === 88 &&
        game.sg.runtimeGameId === 32999 && game.sg.runtimeSlug === 'jjbxmegaways' &&
        game.sg.endpoint === 'https://gls.atc.casinarena.com/gls.rgsx' &&
        game.sg.header.gameID === '20468' &&
        game.sg.header.gameCodeRGI === 'jjbxmegaways' &&
        game.sg.header.versionID === '1_0',
        'AG integrity: own32777 exact native game binding');
}
function own32777NativeSlot(session: object) {
    const slot = own32777NativeSlots.get(session);
    assert(slot?.open, 'AG integrity: own32777 original scope closed');
    own32777AssertGame(slot.game);
    return slot;
}
function own32777StartNativeScope(session: object, game: AGGameConfig) {
    own32777AssertGame(game);
    assert(!own32777NativeStarted.has(session) &&
        !own32777NativeSlots.has(session),
        'AG integrity: own32777 one original Init lifecycle');
    own32777NativeStarted.add(session);
    own32777NativeSlots.set(session, {game,open:true,lastOrdinal:0});
}
function own32777AttachNativeConnection(session: object, connection: any) {
    const slot = own32777NativeSlot(session);
    assert(slot.init && !slot.connection && connection &&
        typeof connection.hasDispatch === 'function',
        'AG integrity: own32777 original Init before native connection');
    slot.connection = connection;
}
function own32777NativeConnection(session: object) {
    const slot = own32777NativeSlot(session);
    assert(slot.connection, 'AG integrity: own32777 native connection absent');
    return slot.connection;
}
function own32777ConsumeNativeDispatch(
    session: object, event: string, dispatch: any, requestSessionID: string
): string {
    const slot = own32777NativeSlot(session);
    const connection = own32777NativeConnection(session);
    assert(slot.init && !slot.inFlight && dispatch &&
        connection.hasDispatch(dispatch) &&
        dispatch.sessionScope === session && dispatch.event === event &&
        dispatch.requestSessionID === requestSessionID &&
        dispatch.intent.sessionScope === session &&
        dispatch.intent.sourceInitFrame === slot.init &&
        dispatch.intent.requestPayload === dispatch.requestPayload &&
        dispatch.intent.requestSessionID === requestSessionID &&
        dispatch.roundScope && typeof dispatch.roundScope === 'object' &&
        !own32777NativeUsedDispatches.has(dispatch),
        'AG integrity: own32777 current one-use native dispatch required');
    assert(own32777HasOriginalAGPaidIntent(session,dispatch.roundScope) &&
        dispatch.intent.originalAGRoundIntent === dispatch.roundScope,
        'AG integrity: own32777 active original AG round capability');
    if (slot.roundScope !== dispatch.roundScope) {
        const cap = dispatch.roundScope;
        const binding = own32777ReadOriginalAGPaidIntent(session,cap);
        const row = own32777OriginalAGRoundIntents.get(session)!;
        const previousFrame = slot.roundScope ? slot.current : slot.init;
        assert(row.phase === 'consumed' && dispatch.event === 'Logic' &&
            dispatch.intent.msgId === 'Logic' &&
            dispatch.intent.command.command === 'Z.Hg.Hg.jv' &&
            dispatch.intent.command.event === 'original-AG-owned-paid-round' &&
            binding.previousRoundScope === (slot.roundScope || null) &&
            binding.admissionFrame === previousFrame &&
            previousFrame && previousFrame.cashRaw === cap.startCashRaw &&
            previousFrame.responseSessionID === requestSessionID &&
            cap.requestSessionID === requestSessionID &&
            (!slot.roundScope || previousFrame.msgId === 'EndGame'),
            'AG integrity: own32777 paid dispatch matches genuine admission frame and updated account');
        // The admission link is needed only until this original one-use dispatch.
        // Delete it to avoid retaining a chain of previous rounds/raw responses.
        own32777OriginalAGRoundBindings.delete(cap);
    }
    slot.roundScope = dispatch.roundScope;
    own32777NativeUsedDispatches.add(dispatch);
    slot.inFlight = dispatch;
    return dispatch.requestPayload;
}
function own32777RememberOriginalRaw(
    session: object, game: AGGameConfig, step: WireStep,
    response: Response, ordinal: number, requestSessionID: string,
    requestHeaders: Record<string,string>, journalPath: string | null,
    dispatch?: any
) {
    const slot = own32777NativeSlot(session);
    assert(slot.game === game && response.ok && response.status >= 200 &&
        response.status < 300 && Number.isSafeInteger(ordinal) &&
        ordinal > slot.lastOrdinal &&
        !own32777NativeRawByStep.has(step),
        'AG integrity: own32777 original successful raw scope required');
    if (step.msgId === 'Init') {
        assert(!slot.init && !dispatch && !slot.inFlight,
            'AG integrity: own32777 one original Init response');
    } else {
        assert(dispatch && slot.inFlight === dispatch &&
            own32777NativeUsedDispatches.has(dispatch) &&
            dispatch.event === step.msgId &&
            dispatch.requestPayload === step.requestPayload &&
            dispatch.requestSessionID === requestSessionID,
            'AG integrity: own32777 original native raw request association');
    }
    const responseHeaders = Object.freeze(
        Array.from(response.headers.entries()).map(row => Object.freeze(row)));
    own32777NativeRawByStep.set(step, Object.freeze({
        sessionScope:session,game,step,msgId:step.msgId,
        requestPayload:step.requestPayload,responsePayload:step.responsePayload,
        endpoint:game.sg.endpoint,ordinal,requestSessionID,
        requestHeaders:Object.freeze({...requestHeaders}),
        httpStatus:response.status,responseHeaders,
        responseSetCookie:Object.freeze(response.headers.getSetCookie?.() || []),
        response,journalPath,
        roundScope:dispatch?.roundScope,nativeIntent:dispatch?.intent
    }));
}
function own32777CommitOriginalSuccess(
    session: object, step: WireStep, originalEnvelope: any, originalCashRaw: number
) {
    const raw = own32777NativeRawByStep.get(step);
    try {
        const slot = own32777NativeSlot(session);
        assert(raw && raw.sessionScope === session && raw.game === slot.game &&
            raw.step === step && step.requestPayload === raw.requestPayload &&
            step.responsePayload === raw.responsePayload &&
            raw.ordinal > slot.lastOrdinal &&
            originalEnvelope?.type === raw.msgId &&
            String(originalEnvelope.Header?.gameID) === '20468' &&
            String(originalEnvelope.Header?.versionID) === '1_0' &&
            typeof originalEnvelope.Header?.sessionID === 'string' &&
            originalEnvelope.Header.sessionID.length > 0 &&
            !originalEnvelope.Error && !originalEnvelope.Errors &&
            Number.isSafeInteger(originalCashRaw) && originalCashRaw >= 0,
            'AG integrity: own32777 original envelope success association');
        const balances = list(originalEnvelope.Balances?.Balance)
            .filter((row: any) => row.name === 'CASH_BALANCE');
        assert(balances.length === 1 &&
            integer(balances[0].value,'own32777 original cash') === originalCashRaw,
            'AG integrity: own32777 original cash authority required');
        if (raw.msgId === 'Init') {
            assert(!slot.init && !raw.nativeIntent && !slot.inFlight &&
                originalEnvelope.Header.isRecovering === 'N',
                'AG integrity: own32777 fresh normal Init only');
        } else {
            assert(slot.init && slot.inFlight &&
                slot.inFlight.intent === raw.nativeIntent &&
                slot.inFlight.roundScope === raw.roundScope &&
                own32777NativeUsedDispatches.has(slot.inFlight),
                'AG integrity: own32777 current native success intent required');
        }
        const frame = Object.freeze({...raw,
            kind:raw.msgId === 'Init'
                ? 'original-ag-live-own32777-Init-wire-DATA-only'
                : 'original-ag-live-own32777-gameplay-wire-DATA-only',
            cashRaw:originalCashRaw,responseSessionID:originalEnvelope.Header.sessionID
        });
        own32777NativeIssued.add(frame);
        if (raw.msgId === 'Init') slot.init = frame;
        else {
            slot.current = frame;
            slot.inFlight = undefined;
        }
        slot.lastOrdinal = raw.ordinal;
        return frame;
    } finally {
        own32777NativeRawByStep.delete(step);
    }
}
export const own32777OriginalSource = Object.freeze({
    hasOriginalAGRoundIntent: own32777HasOriginalAGPaidIntent,
    readOriginalAGRoundIntent: own32777ReadOriginalAGPaidIntent,
    consumeOriginalAGRoundIntent: own32777ConsumeOriginalAGPaidIntent,
    readInit(session: object) {
        const slot = own32777NativeSlot(session);
        assert(slot.init,'AG integrity: own32777 no original validated Init');
        return slot.init;
    },
    readCurrent(session: object, roundScope: object) {
        const slot = own32777NativeSlot(session);
        assert(slot.current && slot.current.roundScope === roundScope &&
            slot.roundScope === roundScope,
            'AG integrity: own32777 no current own round frame');
        return slot.current;
    },
    has(value: unknown) {
        if (!value || typeof value !== 'object' ||
            !own32777NativeIssued.has(value)) return false;
        const frame = value as any;
        const slot = own32777NativeSlots.get(frame.sessionScope);
        return !!slot?.open && slot.game === frame.game &&
            (slot.init === frame || slot.current === frame) &&
            frame.step.requestPayload === frame.requestPayload &&
            frame.step.responsePayload === frame.responsePayload;
    }
});
function own32777RevokeNativeScope(session: object): unknown {
    const slot = own32777NativeSlots.get(session);
    if (!slot) return;
    slot.open = false;
    const paid = own32777OriginalAGRoundIntents.get(session);
    if (paid) own32777OriginalAGRoundBindings.delete(paid.cap);
    own32777OriginalAGRoundIntents.delete(session);
    own32777NativeSlots.delete(session);
    const connection = slot.connection;
    slot.connection = undefined;
    slot.init = undefined;
    slot.current = undefined;
    slot.inFlight = undefined;
    slot.roundScope = undefined;
    try { connection?.close(); }
    catch (error) {
        own32777NativeCleanupFailure.set(session,error);
        return error;
    }
}
function own32777ThrowPreservingOriginal(
    session: object, error: unknown, close: () => void
): never {
    try { close(); }
    catch (cleanupError) {
        own32777NativeCleanupFailure.set(session,cleanupError);
    }
    throw error;
}

const Own32777NativeConnection = require("./own32777-native-data/own32777-original-AG-connection-v11.cjs");
const Own32777NativeHost = require("./own32777-native-data/own32777-native-host-v11.cjs");
const Own32769NativeConnection = require("./own32769-original-ag-native-bridge.cjs");
const own32769NativeBridges = new WeakMap<object, any>();
const own32769NativeInitStarted = new WeakSet<object>();
const own32769NativeRawByStep = new WeakMap<WireStep, any>();
const own32769NativeCleanupFailure = new WeakMap<object, unknown>();
export function readOwn32769NativeCleanupFailure(session: object): unknown {
    return own32769NativeCleanupFailure.get(session);
}

const own32769NativeCurrentFrame = new WeakMap<object, any>();
const own32769NativeIssuedFrames = new WeakSet<object>();
function own32769NativeBridge(session: object): any {
    const value = own32769NativeBridges.get(session);
    assert(value, 'AG integrity: own32769 original native bridge not initialized');
    return value;
}
export const own32769OriginalGameplaySource = Object.freeze({
    read(session: object, roundScope: object): any {
        const frame = own32769NativeCurrentFrame.get(session);
        assert(frame && frame.roundScope === roundScope &&
            own32769ValidatedInit.has(session),
            'AG integrity: own32769 current gameplay frame unavailable');
        return frame;
    },
    has(value: any): boolean {
        return typeof value === 'object' && value !== null &&
            own32769NativeIssuedFrames.has(value) &&
            own32769ValidatedInit.has(value.sessionScope) &&
            own32769NativeCurrentFrame.get(value.sessionScope) === value;
    }
});
export function readOwn32769OriginalNativeGraph(session: object): any {
    return own32769NativeBridge(session).graph();
}
export function readOwn32769CurrentOriginalGameplayFrame(session: object): any {
    const frame = own32769NativeCurrentFrame.get(session);
    assert(own32769OriginalGameplaySource.has(frame),
        'AG integrity: own32769 no current original gameplay frame');
    return frame;
}

const xml = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false,parseTagValue:false});
const list = (v: any): any[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
const integer = (v: unknown, name: string): number => {
    assert(typeof v === 'string' && /^\d+$/.test(v), `AG integrity: SG missing ${name}`);
    const n = Number(v); assert(Number.isSafeInteger(n), `AG integrity: SG unsafe ${name}`); return n;
};
const escape = (v: unknown) => String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');


// Own Dragon client decodes these as board positions, not network actions or wins.
// Bind the decoder to this exact game and its declared 5-by-3 wild features.

// Golden Chief client parses these paid-spin display fields without requesting
// another wager. Real gamble/totem/free fields still require their own mapping.
function ownPaidKeys(value:any,names:string,label:string) {
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.split('|').sort().join('|'),`AG integrity: SG ${label} schema`);
}
function ownPositionNumbers(value:any,count:number|undefined,label:string):number[] {
 assert(typeof value==='string'&&/^\d+(\|\d+)*$/.test(value),`AG integrity: SG ${label} positions`);
 const numbers=value.split('|').map((n:string)=>integer(n,label));
 if(count!==undefined)assert(numbers.length===count,`AG integrity: SG ${label} position count`);
 return numbers;
}
// Private FIRST rule delivery. No transport, scheduler, capture or DB authority.
// Insert after the existing imports/helpers in A's isolated sg.session.ts.
export function ownDCFlowBinding(game: AGGameConfig) {
 const c = game.sg.ownDCNextEndContract;
 assert(game.provider === 'sg' && game.gameId === '32762' && game.dbName === 'sg_desertcats'
  && game.sg.protocol === 'wms' && game.sg.runtimeGameId === 32984
  && game.sg.header.gameID === '20315' && game.sg.header.gameCodeRGI === 'desertcats'
  && game.sg.betRaw === 200, 'AG integrity: SG DC own identity');
 assert(c?.version === 'own-desert-cats-real-next-end-v2'
  && c.ownSDKFileSHA256 === '63f9a390532c8df0779ab95c89f689f817569c23fb7739dbbc6ff73d8c28193d'
  && c.sourceMethodsSHA256 === '79e5ce4a3321b551f8b1d91eee07c925e4627d5253439ce6321cc368102e8ae8'
  && c.cashPath === 'BGInfo/totalWagerWin' && c.rawRequestResponsePreserved
  && c.originalAGMoneyReplayMongoRequired && c.noSyntheticTerminal && c.unmappedFlowStops
  && c.noOldUnknownPOSTReplay, 'AG integrity: SG DC own source contract');
 assert(c.logicRequestDataXML === '<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Stake total="200"/>'
  && c.endRequestDataXML === ''
  && JSON.stringify(game.sg.stake) === JSON.stringify({total:'200'})
  && JSON.stringify(game.sg.freeStake) === JSON.stringify({total:'200'})
  && game.sg.desertCatsContract === undefined && game.sg.logicPaylineCount === undefined,
  'AG integrity: SG DC explicit own Logic DATA');
 return c;
}

export function validateOwnDCFlow(game: AGGameConfig, g: any, first: boolean, previousFree: any, envelope: any) {
 ownDCFlowBinding(game);
 assert(g && typeof g === 'object' && !Array.isArray(g)
  && g.BGInfo && typeof g.BGInfo === 'object' && !Array.isArray(g.BGInfo),
  'AG integrity: SG DC actual result cash missing');
 assert(integer(g.stake, 'DC actual wager') === game.sg.betRaw, 'AG integrity: SG DC changed wager');
 const win = integer(g.BGInfo.totalWagerWin, 'DC actual cumulative wager cash');
 // UI max state assignment is not established by the retained source bundle.
 // Do not turn a new cap/recovery/interactive response into an assumed close.
 assert(g.BGInfo.isMaxWin === '0', 'AG integrity: SG DC maximum-win state needs mapping');
 if(g.BGInfo.baseGameSpinsRemaining !== undefined)
  assert(integer(g.BGInfo.baseGameSpinsRemaining, 'DC actual base remaining') === 0,
   'AG integrity: SG DC base continuation needs mapping');
 if(g.BGInfo.isBigBet !== undefined)
  assert(g.BGInfo.isBigBet === '0', 'AG integrity: SG DC extra wager needs mapping');
 // The own client decodes/consumes the main ReelResults, BGInfo and FSInfo.
 // This passive reel container neither selects recovery nor supplies money.
 const recovery = g.BaseGameRecoveryInfo;
 if(recovery !== undefined) {
  assert(envelope?.Header?.isRecovering === 'N'
   && recovery && typeof recovery === 'object' && !Array.isArray(recovery)
   && Object.keys(recovery).length === 1 && Object.prototype.hasOwnProperty.call(recovery, 'ReelResults')
   && recovery.ReelResults && typeof recovery.ReelResults === 'object'
   && !Array.isArray(recovery.ReelResults),
   'AG integrity: SG DC recovery container needs mapping');
 }
 const unmapped = new Set(['PickerInfo','DecisionInfo','Feature','BonusData','BonusWheel',
  'BFInfo','IRFInfo','NextActionInfo','BaseGameRecoveryInfo','JackpotInfo','GambleInfo']);
 const check = (value: any): void => {
  if(Array.isArray(value)) { value.forEach(check); return; }
  if(value && typeof value === 'object') for(const [key, child] of Object.entries(value)) {
   const ownPaidReels = key === 'BaseGameRecoveryInfo' && value === g
    && recovery !== undefined && child === recovery;
   assert(ownPaidReels || !unmapped.has(key), 'AG integrity: SG DC actual next control needs mapping');
   if(child && typeof child === 'object') check(child);
  }
 };
 assert(envelope && envelope.GameResult === g, 'AG integrity: SG DC actual envelope/result binding');
 check(envelope);
 // DC.parseGameResult calls FreeSpins.clear before its conditional FS parser.
 // That source clear writes remaining=null, not a synthetic zero counter.
 // With no actual FS selector, initial ordinary play can request real EndGame.
 if(g.FSInfo === undefined) {
  assert(first && previousFree === undefined, 'AG integrity: SG DC active free selector disappeared');
  const actualSpins = g.ReelResults?.ReelSpin;
  const spins = Array.isArray(actualSpins) ? actualSpins : actualSpins ? [actualSpins] : [];
  assert(spins.length > 0 && spins.every((s:any) => s && typeof s === 'object'
   && s.freeSpin === 'N' && s.bonusAwarded === 'N'),
   'AG integrity: SG DC ordinary result has an unmapped feature selector');
  return {win, free:undefined, next:'PLAY'};
 }
 assert(g.FSInfo && typeof g.FSInfo === 'object' && !Array.isArray(g.FSInfo),
  'AG integrity: SG DC invalid FS selector');
 const f = g.FSInfo;
 assert(f.isMaxWin === '0', 'AG integrity: SG DC free maximum-win state needs mapping');
 const played = integer(f.freeSpinNumber, 'DC actual free played');
 const total = integer(f.freeSpinsTotal, 'DC actual free total');
 assert(played <= total, 'AG integrity: SG DC invalid free remaining');
 if(first) assert(previousFree === undefined && played === 0, 'AG integrity: SG DC initial free recovery needs mapping');
 else assert(previousFree && Number.isSafeInteger(previousFree.freeSpinsRemaining)
  && previousFree.freeSpinsRemaining > 0, 'AG integrity: SG DC Logic without an active own selector');
 const free = {freeSpinsTotal:total, freeSpinsPlayed:played, freeSpinsRemaining:total-played,
  accumulativeWin:win/100};
 // PLAY requests the original EndGame; only its actual ACK can yield SPIN.
 return {win, free, next:free.freeSpinsRemaining > 0 ? 'FREE_SPIN' : 'PLAY'};
}

function ownHealthyPaidBinding(game:AGGameConfig):'desert'|'jinji' {
 if(game.sg.desertCatsContract) {
  assert(game.gameId==='32762'&&game.dbName==='sg_desertcats'&&game.sg.runtimeGameId===32984&&game.sg.header.gameID==='20315'&&game.sg.header.gameCodeRGI==='desertcats'&&game.sg.desertCatsContract==='desert-cats-own-paid-components-v1'&&game.sg.logicPaylineCount==='50'&&game.sg.betRaw===200,'AG integrity: SG Desert Cats own binding');return 'desert';
 }
 assert(game.gameId==='32778'&&game.dbName==='sg_jinjibaoxiendlesstreasure'&&game.sg.runtimeGameId===33000&&game.sg.header.gameID==='20322'&&game.sg.header.gameCodeRGI==='jinjibaoxiendlesstreasure'&&game.sg.jinjiEndlessContract==='jinji-endless-own-scatter-bank-v1'&&game.sg.logicPaylineCount==='1'&&game.sg.betRaw===16,'AG integrity: SG Jin Ji Endless own binding');return 'jinji';
}
// Observed paid rounds only. Real new gameplay branches require own evidence;
// display values stay in exact source bytes and cannot create extra money.
export function validateOwnRequestVariantData(game:AGGameConfig,g:any,freeIntro=false):number {
 if(freeIntro)assert(game.gameId==='32769'&&game.sg.fudaFreeContract==='fuda-own-natural-free-v4','AG integrity: SG Fu own free scope');
 const fuda=!!game.sg.fudaPaidContract,label=fuda?'Fu Dao Le':'Heidis Bier Haus';
 if(fuda)assert(game.gameId==='32769'&&game.dbName==='sg_fudaole'&&game.sg.runtimeGameId===32991&&game.sg.header.gameID==='20135'&&game.sg.header.gameCodeRGI==='fudaole'&&game.sg.logicRequestNode==='WagerInfo'&&game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&game.sg.betRaw===200,'AG integrity: SG Fu Dao Le binding');
 else assert(game.gameId==='32772'&&game.dbName==='sg_heidis_bier_haus'&&game.sg.runtimeGameId===32994&&game.sg.header.gameID==='20157'&&game.sg.header.gameCodeRGI==='heidisbierhaus'&&game.sg.heidiPaidContract==='heidi-own-paid-display-v1'&&game.sg.betRaw===75,'AG integrity: SG Heidis binding');
 ownPaidKeys(g,fuda?'totalStake|waysCount|totalWin|betID|MysteryRepSymbol|ReelResults|GameWinInfo|GameRtpInfo'+(freeIntro?'|Feature':''):'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|MystInfo|WildInfo|BaseGameInfo'+(g.BonusReplacementInfo!==undefined?'|BonusReplacementInfo':''),label);
 assert(integer(fuda?g.totalStake:g.stake,label+' stake')===game.sg.betRaw&&typeof g.betID==='string',`AG integrity: SG ${label} stake`);
 if(fuda)assert(g.waysCount==='243',`AG integrity: SG ${label} ways`);else assert(g.stakePerLine==='1'&&g.paylineCount==='50',`AG integrity: SG ${label} line stake`);
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin',label+' reel');const reels=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&reels.length===1,`AG integrity: SG ${label} reel count`);const r=reels[0];
 const redEnvelope=fuda&&g.MysteryRepSymbol?.isRedEnvlpJkpt==='Y';
 ownPaidKeys(r,fuda?'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':'')+(r.ScatterWin!==undefined?'|ScatterWin':''):'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops'+(r.PaylineWin!==undefined?'|PaylineWin':''),label+' spin');
 integer(r.reelsetIndex,label+' reel set');assert(r.freeSpin===(freeIntro?'Y':'N')&&r.bonusAwarded===(freeIntro||redEnvelope?'Y':'N')&&(freeIntro||redEnvelope?integer(r.scatterWinCount,label+' scatter count')>0:(fuda?r.scatterWinCount:r.winCountSC)==='0'),`AG integrity: SG ${label} feature needs own mapping`);if(!fuda)assert(r.spinIndex==='0',`AG integrity: SG ${label} spin order`);ownPositionNumbers(r.ReelStops,fuda?5:6,label+' reel positions');
 const wins=list(fuda?r.AnywayWin:r.PaylineWin),seen=new Set<number>();assert(wins.length===integer(fuda?r.anywayWinCount:r.winCountPL,label+' win count'),`AG integrity: SG ${label} win count`);let win=0;
 for(const w of wins) {
  ownPaidKeys(w,fuda?'winIndex|winVal|ways|awardIndex|#text':'index|winVal|awardIndex|awardTableIndex|#text',label+' prize');const i=integer(fuda?w.winIndex:w.index,label+' prize index');assert(!seen.has(i)&&(fuda?i<wins.length:i<50),`AG integrity: SG ${label} duplicate prize`);seen.add(i);integer(w.awardIndex,label+' award');
  if(fuda){const ways=integer(w.ways,label+' ways');assert(ways>0&&ways<=243,`AG integrity: SG ${label} ways bound`);}else assert(w.awardTableIndex==='0',`AG integrity: SG ${label} award table`);
  ownPositionNumbers(w['#text'],undefined,label+' prize positions');win+=integer(w.winVal,label+' win');
 }
 if(fuda){
  assert(win===integer(r.totalWayWin,label+' way win'),`AG integrity: SG ${label} way components`);
  const scatters=list(r.ScatterWin),scatterIndexes=new Set<number>();assert(scatters.length===integer(r.scatterWinCount,label+' scatter count'),`AG integrity: SG ${label} scatter count`);let scatterWin=0;
  for(const w of scatters){ownPaidKeys(w,'winIndex|winVal|awardIndex|#text',label+' scatter');const i=integer(w.winIndex,label+' scatter index');assert(i<scatters.length&&!scatterIndexes.has(i),`AG integrity: SG ${label} duplicate scatter`);scatterIndexes.add(i);integer(w.awardIndex,label+' scatter award');const positions=ownPositionNumbers(w['#text'],undefined,label+' scatter positions');assert(positions.every(p=>p<15)&&new Set(positions).size===positions.length,`AG integrity: SG ${label} scatter board`);scatterWin+=integer(w.winVal,label+' scatter money');}
  assert(Number.isSafeInteger(scatterWin)&&scatterWin===integer(r.totalScatterWin,label+' scatter total')&&(redEnvelope?scatterWin>0:scatterWin===0),`AG integrity: SG ${label} scatter components`);win+=scatterWin;
 }
 assert(Number.isSafeInteger(win)&&win===integer(fuda?r.totalSpinWin:r.spinWins,label+' spin win')&&win===integer(g.totalWin,label+' root win'),`AG integrity: SG ${label} current money`);
 if(fuda) {
  ownPaidKeys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|totalPickJkptWin|maxWinValue|isMaxWin',label+' winnings');ownPaidKeys(g.GameRtpInfo,'targetedRtpValue',label+' RTP');
  const w=g.GameWinInfo;assert(integer(w.totalBaseGameWin,label+' base')===win&&integer(w.totalWagerWin,label+' cumulative')===win&&w.totalFreeSpinsWin==='0'&&w.totalPickJkptWin==='0'&&w.maxWinValue==='25000000'&&w.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.06',`AG integrity: SG ${label} money or feature`);
  const m=g.MysteryRepSymbol;ownPaidKeys(m,'isSymPresent|replacementSymbolIndex|isNudgingWild|isRedEnvlpJkpt'+(m.nudgingWildPositions!==undefined?'|nudgingWildPositions':''),label+' mystery');assert(['Y','N'].includes(m.isSymPresent)&&['Y','N'].includes(m.isNudgingWild)&&['Y','N'].includes(m.isRedEnvlpJkpt),`AG integrity: SG ${label} own feature mapping`);integer(m.replacementSymbolIndex,label+' mystery symbol');
  // The client animates already returned nudging cells; there is no extra
  // wager/Pick request. Root, ways/scatter and final cash remain authoritative.
  if(m.isNudgingWild==='Y'){const positions=ownPositionNumbers(m.nudgingWildPositions,undefined,label+' nudging cells');assert(positions.length>0&&positions.every(p=>p<15)&&new Set(positions).size===positions.length,`AG integrity: SG ${label} nudging board`);}
  else assert(m.nudgingWildPositions===undefined||m.nudgingWildPositions==='',`AG integrity: SG ${label} unflagged nudging`);
 } else {
  ownPaidKeys(g.BaseGameInfo,'totalWagerWin|isMaxWin|maxWinValue',label+' base');assert(integer(g.BaseGameInfo.totalWagerWin,label+' cumulative')===win&&g.BaseGameInfo.isMaxWin==='N'&&g.BaseGameInfo.maxWinValue==='25000000',`AG integrity: SG ${label} cumulative money`);
  ownPaidKeys(g.MystInfo,'index',label+' mystery');const mystery=integer(g.MystInfo.index,label+' mystery index');ownPaidKeys(g.WildInfo,'Indices',label+' wild');const wild=g.WildInfo.Indices===''?[]:ownPositionNumbers(g.WildInfo.Indices,undefined,label+' wild reels');assert(wild.every(i=>i<6)&&new Set(wild).size===wild.length,`AG integrity: SG ${label} wild reels`);
  if(mystery===13) {
   ownPaidKeys(g.BonusReplacementInfo,'Reel0|Reel1|Reel2|Reel3|Reel4|Reel5',label+' replacement reels');
   for(let i=0;i<6;i++) {const reel=g.BonusReplacementInfo['Reel'+i];if(reel==='')continue;ownPaidKeys(reel,'RD',label+' replacement');const used=new Set<number>();for(const d of list(reel.RD)){ownPaidKeys(d,'SS|DS',label+' replacement entry');const source=integer(d.SS,label+' source symbol');assert(source>=23&&source<35&&!used.has(source),`AG integrity: SG ${label} replacement index`);used.add(source);integer(d.DS,label+' destination symbol');}}
  } else assert(g.BonusReplacementInfo===undefined,`AG integrity: SG ${label} unexpected replacement`);
 }
 return win;
}
export function validateFudaOwnFreeData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number) {
 assert(game.gameId==='32769'&&game.dbName==='sg_fudaole'&&game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&game.sg.fudaFreeContract==='fuda-own-natural-free-v4','AG integrity: SG Fu own free binding');
 if(first&&g.Feature===undefined)return {win:validateOwnRequestVariantData(game,g),free:undefined,base:undefined};
 ownPaidKeys(g.Feature,'index|name|data','Fu free feature');assert(g.Feature.index==='1'&&g.Feature.name==='FreeGame','AG integrity: SG Fu unreviewed feature');
 if(first){
  assert(!prior&&!base&&previousWin===0,'AG integrity: SG Fu intro order');
  ownPaidKeys(g.Feature.data,'remainingFreeSpins|extraFreeSpinsAwarded|totalFreeSpinsPlayed|freeSpinTriggerWin','Fu intro counters');
  const f=g.Feature.data,total=integer(f.remainingFreeSpins,'Fu returned free total');assert(total>0&&f.totalFreeSpinsPlayed==='0'&&f.extraFreeSpinsAwarded==='0','AG integrity: SG Fu intro counters');integer(f.freeSpinTriggerWin,'Fu trigger display win');
  const win=validateOwnRequestVariantData(game,g,true);
  return {win,free:{freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100},base:structuredClone(g)};
 }
 assert(prior&&prior.freeSpinsRemaining>0&&base,'AG integrity: SG Fu free continuation order');
 ownPaidKeys(g,'totalStake|waysCount|totalWin|betID|MysteryRepSymbol|ReelResults|Feature|BaseGameRecoveryInfo|GameWinInfo|GameRtpInfo','Fu free result');
 assert(g.totalStake==='200'&&g.waysCount==='243'&&g.betID===base.betID,'AG integrity: SG Fu free wager');
 ownPaidKeys(g.Feature.data,'remainingFreeSpins|extraFreeSpinsAwarded|totalFreeSpinsPlayed|freeSpinTriggerWin|lastFreeSpin','Fu free counters');
 const f=g.Feature.data,remaining=integer(f.remainingFreeSpins,'Fu free remaining'),played=integer(f.totalFreeSpinsPlayed,'Fu free played'),award=integer(f.extraFreeSpinsAwarded,'Fu actual awarded'),trigger=integer(f.freeSpinTriggerWin,'Fu free trigger');
 assert(played===prior.freeSpinsPlayed+1&&remaining===prior.freeSpinsRemaining-1+award&&remaining+played===prior.freeSpinsTotal+award&&trigger===integer(base.Feature.data.freeSpinTriggerWin,'Fu original trigger')&&f.lastFreeSpin===(remaining===0?'Y':'N'),'AG integrity: SG Fu counter or terminal');
 ownPaidKeys(g.BaseGameRecoveryInfo,'GameResult','Fu own recovery');
 const projection={totalStake:base.totalStake,waysCount:base.waysCount,totalWin:base.totalWin,betID:base.betID,MysteryRepSymbol:base.MysteryRepSymbol,ReelResults:base.ReelResults};
 assert.deepStrictEqual(g.BaseGameRecoveryInfo.GameResult,projection,'AG integrity: SG Fu base recovery changed');
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','Fu free reels');assert(g.ReelResults.numSpins==='1'&&!Array.isArray(g.ReelResults.ReelSpin),'AG integrity: SG Fu free reel count');
 const r=g.ReelResults.ReelSpin,m=g.MysteryRepSymbol,red=m?.isRedEnvlpJkpt==='Y';
 ownPaidKeys(r,'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':'')+(r.ScatterWin!==undefined?'|ScatterWin':''),'Fu free reel');
 integer(r.reelsetIndex,'Fu free set');ownPositionNumbers(r.ReelStops,5,'Fu free stops');assert(r.freeSpin==='Y'&&r.bonusAwarded===(red?'Y':'N'),'AG integrity: SG Fu free marker');
 const ways=list(r.AnywayWin),scatters=list(r.ScatterWin);assert(ways.length===integer(r.anywayWinCount,'Fu free way count')&&scatters.length===integer(r.scatterWinCount,'Fu free scatter count'),'AG integrity: SG Fu free declared awards');
 let wayWin=0,scatterWin=0;const wayIds=new Set<number>(),scatterIds=new Set<number>();
 for(const w of ways){ownPaidKeys(w,'winIndex|winVal|ways|awardIndex|#text','Fu free way');const id=integer(w.winIndex,'Fu free way id'),count=integer(w.ways,'Fu free way count');assert(id<ways.length&&!wayIds.has(id)&&count>0&&count<=243,'AG integrity: SG Fu free way index');wayIds.add(id);integer(w.awardIndex,'Fu free award');const pos=ownPositionNumbers(w['#text'],undefined,'Fu free way positions');assert(pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free way board');wayWin+=integer(w.winVal,'Fu free way cash');}
 for(const w of scatters){ownPaidKeys(w,'winIndex|winVal|awardIndex|#text','Fu free scatter');const id=integer(w.winIndex,'Fu free scatter id');assert(id<scatters.length&&!scatterIds.has(id),'AG integrity: SG Fu free scatter index');scatterIds.add(id);integer(w.awardIndex,'Fu free scatter award');const pos=ownPositionNumbers(w['#text'],undefined,'Fu free scatter positions');assert(pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free scatter board');scatterWin+=integer(w.winVal,'Fu free scatter cash');}
 const current=integer(g.totalWin,'Fu free current');assert(Number.isSafeInteger(wayWin)&&Number.isSafeInteger(scatterWin)&&wayWin===integer(r.totalWayWin,'Fu free ways')&&scatterWin===integer(r.totalScatterWin,'Fu free scatters')&&(red?scatterWin>0:scatterWin===0)&&current===wayWin+scatterWin&&current===integer(r.totalSpinWin,'Fu free spin cash'),'AG integrity: SG Fu free current components');
 ownPaidKeys(m,'isSymPresent|replacementSymbolIndex|isNudgingWild|isRedEnvlpJkpt'+(m.nudgingWildPositions!==undefined?'|nudgingWildPositions':''),'Fu free mystery');assert(['Y','N'].includes(m.isSymPresent)&&['Y','N'].includes(m.isNudgingWild)&&['Y','N'].includes(m.isRedEnvlpJkpt),'AG integrity: SG Fu free display flags');integer(m.replacementSymbolIndex,'Fu free mystery symbol');
 if(m.isNudgingWild==='Y'){const pos=ownPositionNumbers(m.nudgingWildPositions,undefined,'Fu free nudging');assert(pos.length>0&&pos.every(p=>p<15)&&new Set(pos).size===pos.length,'AG integrity: SG Fu free nudging board');}else assert(m.nudgingWildPositions===undefined||m.nudgingWildPositions==='','AG integrity: SG Fu unflagged free nudging');
 ownPaidKeys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|totalPickJkptWin|maxWinValue|isMaxWin','Fu free winnings');ownPaidKeys(g.GameRtpInfo,'targetedRtpValue','Fu free RTP');
 const w=g.GameWinInfo,baseWin=integer(base.totalWin,'Fu original paid cash'),win=integer(w.totalWagerWin,'Fu returned cumulative'),freeWin=integer(w.totalFreeSpinsWin,'Fu returned free cash');
 // The returned trigger display award enters cumulative free cash on the first
 // natural free response, exactly once. It is absent from paid current cash.
 assert(integer(w.totalBaseGameWin,'Fu unchanged base cash')===baseWin&&win===baseWin+freeWin&&win===previousWin+current+(prior.freeSpinsPlayed===0?trigger:0)&&w.totalPickJkptWin==='0'&&w.maxWinValue==='25000000'&&w.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.06','AG integrity: SG Fu free cumulative components');
 return {win,free:{freeSpinsTotal:remaining+played,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100},base};
}
// Own Cool Jewels client decodes each cascade cell award, not an extra wager.
// This contract covers actual ordinary cascade records; new Feature data is
// retained as a real own fault rather than manufactured as a zero bonus.
export function validateCoolJewelsFreeData(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number){
 assert(game.sg.coolJewelsFreeContract==='cool-jewels-own-topup-retrigger-v3','AG integrity: SG Cool Jewels own free contract');
 if(first&&!g.Feature)return {win:validateCoolJewelsPaidData(game,g),free:undefined,base:undefined};
 ownPaidKeys(g.Feature,'index|FS_Info','Cool Jewels feature');assert(g.Feature.index==='0'&&!Array.isArray(g.Feature.FS_Info),'AG integrity: SG Cool Jewels feature index');
 const f=g.Feature.FS_Info;
 if(first){
  ownPaidKeys(f,'fsAwarded','Cool Jewels paid free intro');const total=integer(f.fsAwarded,'Cool Jewels actual intro budget');assert(total>0,'AG integrity: SG Cool Jewels zero intro');
  const win=validateCoolJewelsPaidData(game,g,'trigger');return {win,base:structuredClone(g),free:{freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100}};
 }
 assert(prior&&base,'AG integrity: SG Cool Jewels missing original free state');
 ownPaidKeys(f,'totalSpinsWon|currentSpin|entryWin|currentFSWins|totalGameWins|winTopUp|fsAwarded','Cool Jewels free counters and money');
 const total=integer(f.totalSpinsWon,'Cool Jewels actual total'),played=integer(f.currentSpin,'Cool Jewels played'),award=integer(f.fsAwarded,'Cool Jewels returned award');
 assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+award&&played<=total,'AG integrity: SG Cool Jewels nonadvancing or lost free budget');
 const current=validateCoolJewelsPaidData(game,g,'free'),entry=integer(f.entryWin,'Cool Jewels original entry cash'),freeWin=integer(f.currentFSWins,'Cool Jewels cumulative free cash'),win=integer(f.totalGameWins,'Cool Jewels total cash');
 const topup=integer(f.winTopUp,'Cool Jewels actual terminal guarantee');assert(played===total||topup===0,'AG integrity: SG Cool Jewels premature guarantee');
 assert(entry===integer(base.totalWin,'Cool Jewels original paid cash')&&entry+freeWin+topup===win&&previousWin+current+topup===win,'AG integrity: SG Cool Jewels cash components or cumulative delta');
 if(played===total){
  ownPaidKeys(g.PreFS_Info,'visSymbols','Cool Jewels terminal paid display');ownPositionNumbers(g.PreFS_Info.visSymbols,36,'Cool Jewels recovery symbols');
  const drops=list(base.ReactorChain.ReactorDrop),original=drops[drops.length-1].ReactorLayout.symbols;assert(g.PreFS_Info.visSymbols===original,'AG integrity: SG Cool Jewels original paid display changed');
 }else assert(g.PreFS_Info===undefined,'AG integrity: SG Cool Jewels premature recovery');
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100}};
}
export function validateCoolJewelsPaidData(game:AGGameConfig,g:any,mode:'ordinary'|'trigger'|'free'='ordinary'):number {
 assert(game.gameId==='32758'&&game.dbName==='sg_cooljewels_prt'&&game.sg.runtimeGameId===32980&&game.sg.header.gameID==='20150'&&game.sg.header.gameCodeRGI==='cooljewels_prt'&&game.sg.coolJewelsPaidContract==='cool-jewels-own-reactor-paid-v1'&&game.sg.betRaw===50,'AG integrity: SG Cool Jewels own binding');
 assert(mode==='ordinary'||game.sg.coolJewelsFreeContract==='cool-jewels-own-topup-retrigger-v3','AG integrity: SG Cool Jewels free binding');
 ownPaidKeys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|ReactorChain|MaxWin_Info'+(mode!=='ordinary'?'|Feature':'')+(mode==='free'&&g.PreFS_Info!==undefined?'|PreFS_Info':''),'Cool Jewels result');assert(g.stake==='50'&&g.stakePerLine==='0'&&g.paylineCount==='0'&&typeof g.betID==='string','AG integrity: SG Cool Jewels own wager');
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','Cool Jewels reels');assert(g.ReelResults.numSpins==='1'&&!Array.isArray(g.ReelResults.ReelSpin),'AG integrity: SG Cool Jewels reel count');const r=g.ReelResults.ReelSpin;
 ownPaidKeys(r,'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops','Cool Jewels ordinary reel');assert(r.spinIndex==='0'&&r.winCountPL==='0'&&r.winCountSC==='0'&&r.spinWins==='0'&&r.freeSpin===(mode==='free'?'Y':'N')&&r.bonusAwarded===(mode==='trigger'?'Y':'N'),'AG integrity: SG Cool Jewels new action or reel cash');integer(r.reelsetIndex,'Cool Jewels reel set');ownPositionNumbers(r.ReelStops,6,'Cool Jewels stops');
 ownPaidKeys(g.ReactorChain,'num_drops|ReactorDrop','Cool Jewels chain');const drops=list(g.ReactorChain.ReactorDrop);assert(drops.length>0&&drops.length===integer(g.ReactorChain.num_drops,'Cool Jewels drop count'),'AG integrity: SG Cool Jewels chain count');
 const coordinate=(value:any)=>{assert(typeof value==='string'&&/^\d+,\d+$/.test(value),'AG integrity: SG Cool Jewels position');const pos=value.split(',').map((q:string)=>integer(q,'Cool Jewels coordinate'));assert(pos.every((q:number)=>q<6),'AG integrity: SG Cool Jewels board');return value;};
 let total=0;
 for(const [i,d]of drops.entries()){
  ownPaidKeys(d,'drop_order|num_clusters|ReactorLayout'+(d.ReactorCluster!==undefined?'|ReactorCluster':''),'Cool Jewels drop');assert(integer(d.drop_order,'Cool Jewels drop order')===i,'AG integrity: SG Cool Jewels drop order');ownPaidKeys(d.ReactorLayout,'symbols','Cool Jewels layout');ownPositionNumbers(d.ReactorLayout.symbols,36,'Cool Jewels symbols');
  const clusters=list(d.ReactorCluster);assert(clusters.length===integer(d.num_clusters,'Cool Jewels cluster count'),'AG integrity: SG Cool Jewels cluster count');
  if(i===drops.length-1)assert(clusters.length===0,'AG integrity: SG Cool Jewels incomplete cascade');else assert(clusters.length>0,'AG integrity: SG Cool Jewels empty intermediate cascade');
  for(const [ci,c]of clusters.entries()){
   ownPaidKeys(c,'id|cluster_positions|cluster_awards|rootSymbol|rootSymbolPos|watermark','Cool Jewels cluster');assert(integer(c.id,'Cool Jewels cluster id')===ci,'AG integrity: SG Cool Jewels cluster id');integer(c.rootSymbol,'Cool Jewels root symbol');coordinate(c.rootSymbolPos);integer(c.watermark,'Cool Jewels watermark');assert(typeof c.cluster_positions==='string','AG integrity: SG Cool Jewels cluster positions');const positions=c.cluster_positions.split('|').map(coordinate),awards=ownPositionNumbers(c.cluster_awards,undefined,'Cool Jewels paired awards');assert(positions.length>0&&positions.length===awards.length&&new Set(positions).size===positions.length,'AG integrity: SG Cool Jewels paired awards');total+=awards.reduce((a,b)=>a+b,0);assert(Number.isSafeInteger(total),'AG integrity: SG Cool Jewels unsafe total');
  }
 }
 ownPaidKeys(g.MaxWin_Info,'maxWinValue|maxWin|cappedWins','Cool Jewels cap');assert(g.MaxWin_Info.maxWinValue==='25000000'&&g.MaxWin_Info.maxWin==='false'&&g.MaxWin_Info.cappedWins==='0','AG integrity: SG Cool Jewels own cap mapping needed');assert(total===integer(g.totalWin,'Cool Jewels returned cash'),'AG integrity: SG Cool Jewels current cash components');return total;
}
export function validateHealthyPaidData(game:AGGameConfig,g:any):number {
 const desert=ownHealthyPaidBinding(game)==='desert',label=desert?'Desert Cats':'Jin Ji Endless';
 ownPaidKeys(g,desert?'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|QuickHits|Symbol|WildReel':'stake|totalWin|betID|ReelResults|BGInfo|MysterySymbol|ScatterInfo',label);
 assert(integer(g.stake,label+' stake')===game.sg.betRaw&&typeof g.betID==='string',`AG integrity: SG ${label} wager`);
 if(desert)assert(g.stakePerLine==='4'&&g.paylineCount==='50',`AG integrity: SG ${label} payline stake`);
 ownPaidKeys(g.BGInfo,desert?'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin':'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isMaxWin|goldChanceAwarded|jackpotAwarded|gameMode',label+' base');
 assert(g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isMaxWin==='0',`AG integrity: SG ${label} remaining action`);
 if(desert)assert(g.BGInfo.isBigBet==='0',`AG integrity: SG ${label} paid mode`);
 else assert(g.BGInfo.goldChanceAwarded==='0'&&g.BGInfo.jackpotAwarded==='0'&&g.BGInfo.gameMode==='0',`AG integrity: SG ${label} feature needs own mapping`);
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin',label+' reels');const reels=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&reels.length===1,`AG integrity: SG ${label} current reel count`);const r=reels[0];
 ownPaidKeys(r,desert?'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops'+(r.PaylineWin!==undefined?'|PaylineWin':''):'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin!==undefined?'|AnywayWin':''),label+' spin');
 assert(r.spinIndex==='0'&&r.reelsetIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&(desert?r.winCountSC:r.scatterWinCount)==='0',`AG integrity: SG ${label} unclassified feature`);
 ownPositionNumbers(r.ReelStops,desert?7:5,label+' reel stops');const wins=list(desert?r.PaylineWin:r.AnywayWin),seen=new Set<number>();
 assert(wins.length===integer(desert?r.winCountPL:r.anywayWins,label+' win count'),`AG integrity: SG ${label} win count`);let lineWin=0;
 for(const w of wins) {
  ownPaidKeys(w,desert?'index|winVal|awardIndex|awardTableIndex|#text':'winIndex|winVal|ways|awardIndex|#text',label+' win');const index=integer(desert?w.index:w.winIndex,label+' win index');assert(!seen.has(index)&&(desert?index<50:index<wins.length),`AG integrity: SG ${label} win index`);seen.add(index);integer(w.awardIndex,label+' award');
  if(desert)assert(w.awardTableIndex==='0',`AG integrity: SG ${label} award table`);else assert(integer(w.ways,label+' ways')>0,`AG integrity: SG ${label} ways`);
  ownPositionNumbers(w['#text'],undefined,label+' winning positions');lineWin+=integer(w.winVal,label+' line win');
 }
 assert(Number.isSafeInteger(lineWin)&&lineWin===integer(desert?r.spinWins:r.totalSpinWin,label+' spin win'),`AG integrity: SG ${label} reel winnings`);let quickHits=0;
 if(desert) {
  ownPaidKeys(g.QuickHits,'winValue|numOfGems',label+' QuickHits');quickHits=integer(g.QuickHits.winValue,label+' QuickHits win');assert(integer(g.QuickHits.numOfGems,label+' gems')<=10,`AG integrity: SG ${label} gems`);
  ownPaidKeys(g.Symbol,'replacement',label+' symbol');integer(g.Symbol.replacement,label+' replacement');ownPaidKeys(g.WildReel,'pattern',label+' wild reels');assert(ownPositionNumbers(g.WildReel.pattern,7,label+' wild reels').every(n=>n===0||n===1),`AG integrity: SG ${label} wild bit`);
 } else {
  ownPaidKeys(g.MysterySymbol,'replacementSym',label+' mystery symbol');integer(g.MysterySymbol.replacementSym,label+' replacement');ownPaidKeys(g.ScatterInfo,'totalValue|numScatters|values',label+' scatter bank');const values=ownPositionNumbers(g.ScatterInfo.values,15,label+' scatter bank'),bank=values.reduce((a,b)=>a+b,0);
  assert(Number.isSafeInteger(bank)&&bank===integer(g.ScatterInfo.totalValue,label+' bank total')&&integer(g.ScatterInfo.numScatters,label+' scatter count')<=15,`AG integrity: SG ${label} scatter bank`);
 }
 // Desert SDK subtracts QuickHits from totalWin for line animation. Jin Ji
 // ScatterInfo is a bank display, never an additional current win.
 const win=lineWin+quickHits;assert(Number.isSafeInteger(win)&&win===integer(g.totalWin,label+' current win')&&win===integer(g.BGInfo.bgWinnings,label+' base win')&&win===integer(g.BGInfo.totalWagerWin,label+' cumulative win'),`AG integrity: SG ${label} monetary components`);return win;
}
export function validateEightyFortunesData(game:AGGameConfig,g:any,first:boolean,prior:any,paid:any,priorWin:number):any {
 assert(game.gameId==='32750'&&game.dbName==='sg_eightyeightfortunes'&&game.sg?.runtimeGameId===32972&&game.sg?.header?.gameID==='20077'&&game.sg?.header?.gameCodeRGI==='eightyeightfortunes'&&game.sg?.eightyFortunesContract==='eighty-fortunes-own-free-components-v4'&&game.sg?.betRaw===176,'AG integrity: SG 88 Fortunes binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG 88 Fortunes schema');
 keys(g,'stake|creditBet|betMultiplier|waysCount|totalWin|betID|ReelResults|GameWinInfo|GameRtpInfo'+(g.Feature?'|Feature':'')+(g.BaseGameRecoveryInfo?'|BaseGameRecoveryInfo':''));
 assert(g.stake==='176'&&g.creditBet==='88'&&g.betMultiplier==='2'&&g.waysCount==='243','AG integrity: SG 88 Fortunes wager');
 keys(g.GameWinInfo,'totalWagerWin|totalBaseGameWin|totalFreeSpinsWin|maxWinValue|isMaxWin');keys(g.GameRtpInfo,'targetedRtpValue');assert(g.GameWinInfo.maxWinValue==='25000000'&&g.GameWinInfo.isMaxWin==='N'&&g.GameRtpInfo.targetedRtpValue==='96.00','AG integrity: SG 88 Fortunes variant/cap');
 keys(g.ReelResults,'ReelSpin|numSpins');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG 88 Fortunes reel count');const r=spins[0];
 keys(r,'reelsetIndex|anywayWinCount|scatterWinCount|totalWayWin|totalScatterWin|totalSpinWin|freeSpin|bonusAwarded|ReelStops'+(r.AnywayWin?'|AnywayWin':'')+(r.ScatterWin?'|ScatterWin':''));
 const sets=first?game.sg.eightyFortunesBaseReels:game.sg.eightyFortunesFreeReels;assert(Array.isArray(sets)&&sets.includes(integer(r.reelsetIndex,'88 reel set')),'AG integrity: SG 88 Fortunes advertised reel set');
 assert(typeof r.ReelStops==='string'&&/^\d+(?:\|\d+){4}$/.test(r.ReelStops),'AG integrity: SG 88 Fortunes reel stops');r.ReelStops.split('|').forEach((v:string)=>integer(v,'88 reel stop'));
 const way=list(r.AnywayWin),scatter=list(r.ScatterWin);assert(way.length===integer(r.anywayWinCount,'88 way count')&&scatter.length===integer(r.scatterWinCount,'88 scatter count'),'AG integrity: SG 88 Fortunes win count');
 const sum=(rows:any[],isWay:boolean)=>{let total=0;const seen=new Set<number>();for(const w of rows){keys(w,'#text|winIndex|winVal|awardIndex'+(isWay?'|ways':''));const i=integer(w.winIndex,'88 win index');assert(!seen.has(i),'AG integrity: SG 88 Fortunes repeated win index');seen.add(i);integer(w.awardIndex,'88 award');if(isWay){const n=integer(w.ways,'88 ways');assert(n>0&&n<=243,'AG integrity: SG 88 Fortunes ways');}assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text'])&&w['#text'].split('|').every((v:string)=>integer(v,'88 position')<15),'AG integrity: SG 88 Fortunes positions');total+=integer(w.winVal,'88 win');}assert(Number.isSafeInteger(total),'AG integrity: SG 88 Fortunes money overflow');return total;};
 const ways=sum(way,true),scatters=sum(scatter,false),current=integer(g.totalWin,'88 current'),win=integer(g.GameWinInfo.totalWagerWin,'88 wager win'),base=integer(g.GameWinInfo.totalBaseGameWin,'88 base win'),freeWin=integer(g.GameWinInfo.totalFreeSpinsWin,'88 free win');
 const features=list(g.Feature),indices=new Set<string>();for(const f of features){keys(f,'data|index|name');assert(!indices.has(f.index),'AG integrity: SG 88 repeated feature');indices.add(f.index);}
 const freeFeature=features.find((f:any)=>f.index==='1'&&f.name==='FreeGame'),jackpotFeature=features.find((f:any)=>f.index===(first?'2':'3')&&f.name===(first?'BG_FuBat_Jackpot':'FG_FuBat_Jackpot'));
 assert(features.length===(freeFeature?1:0)+(jackpotFeature?1:0)&&features.length<=2,'AG integrity: SG 88 Fortunes feature requires own mapping');
 const paidJackpot=first&&jackpotFeature!==undefined,freeJackpot=!first&&jackpotFeature!==undefined;let jackpot=0;
 if(jackpotFeature){
  const f=jackpotFeature.data;keys(f,'#text|pickLength|jackpotWin|jackpotType');assert(typeof f['#text']==='string'&&/^[0-3](?:\|[0-3])*$/.test(f['#text']),'AG integrity: SG 88 precomputed jackpot picks');const picks=f['#text'].split('|').map(Number),type=integer(f.jackpotType,'88 jackpot type');assert(type<4&&picks.length===integer(f.pickLength,'88 jackpot pick length')&&picks.filter((v:number)=>v===type).length===3&&r.bonusAwarded==='Y','AG integrity: SG 88 completed jackpot picks');
  if(paidJackpot)assert(!prior&&g.BaseGameRecoveryInfo===undefined&&r.freeSpin===(freeFeature?'Y':'N')&&(freeFeature||freeWin===0),'AG integrity: SG 88 paid jackpot state');
  else assert(prior&&paid&&freeFeature,'AG integrity: SG 88 free jackpot state');jackpot=integer(f.jackpotWin,'88 jackpot amount');
 }
 const trigger=freeFeature?integer(freeFeature.data.freeSpinTriggerWin,'88 trigger'):0;
 // In an ongoing free game the response's current award already includes
 // the retrigger and jackpot components. Each enters the cumulative total once.
 assert(ways===integer(r.totalWayWin,'88 total ways')&&scatters===integer(r.totalScatterWin,'88 total scatter')&&ways+scatters===integer(r.totalSpinWin,'88 spin win')&&ways+scatters+jackpot+(first?0:trigger)===current&&base+freeWin===win&&Number.isSafeInteger(win),'AG integrity: SG 88 Fortunes monetary components');
 if(paidJackpot&&!freeFeature){assert(base===current&&win===current,'AG integrity: SG 88 paid jackpot amount');return {win,free:undefined};}
 if(!g.Feature){assert(first&&!prior&&g.BaseGameRecoveryInfo===undefined&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&freeWin===0&&base===current,'AG integrity: SG 88 Fortunes unclassified state');return {win,free:undefined};}
 assert(freeFeature,'AG integrity: SG 88 missing free feature');const f=freeFeature.data;keys(f,'totalFreeSpinsWin|remainingFreeSpins|extraFreeSpinsAwarded|freeSpinTriggerWin|lastFreeSpin');
 const remaining=integer(f.remainingFreeSpins,'88 remaining'),extra=integer(f.extraFreeSpinsAwarded,'88 extra');assert(integer(f.totalFreeSpinsWin,'88 feature cumulative')===freeWin&&f.lastFreeSpin===(remaining===0?'Y':'N'),'AG integrity: SG 88 Fortunes free state');
 let played,total;
 if(first){assert(!prior&&g.BaseGameRecoveryInfo===undefined&&remaining>0&&extra===0&&trigger===freeWin&&base===current&&r.freeSpin==='Y'&&r.bonusAwarded==='Y','AG integrity: SG 88 Fortunes free introduction');played=0;total=remaining;}
 else {assert(prior&&paid,'AG integrity: SG 88 Fortunes prior free state');keys(g.BaseGameRecoveryInfo,'GameResult');const recovered=g.BaseGameRecoveryInfo.GameResult;keys(recovered,'stake|creditBet|betMultiplier|waysCount|totalWin|betID|ReelResults');const paidJackpotIntro=list(paid.Feature).some((f:any)=>f.index==='2'&&f.name==='BG_FuBat_Jackpot');
 // Own SDK replaces this recovery display total with GameWinInfo.totalWagerWin.
 // A completed paid jackpot is not repeated in the recovered reel display.
 for(const k of Object.keys(recovered)) {
  if(k==='totalWin'&&paidJackpotIntro)assert(recovered.totalWin===paid.totalWin||recovered.totalWin===paid.ReelResults.ReelSpin.totalSpinWin,'AG integrity: SG 88 Fortunes recovery display components changed');
  else assert(JSON.stringify(recovered[k])===JSON.stringify(paid[k]),'AG integrity: SG 88 Fortunes paid recovery changed');
 }assert(base===integer(paid.GameWinInfo.totalBaseGameWin,'88 recovered base')&&remaining===prior.freeSpinsRemaining-1+extra&&win===priorWin+current&&(extra>0)===(trigger>0),'AG integrity: SG 88 Fortunes free budget/money delta');played=prior.freeSpinsPlayed+1;total=prior.freeSpinsTotal+extra;assert(r.freeSpin===(extra>0?'Y':'N')&&r.bonusAwarded===(extra>0||freeJackpot?'Y':'N'),'AG integrity: SG 88 Fortunes retrigger/jackpot flags');}
 assert(played+remaining===total&&Number.isSafeInteger(total),'AG integrity: SG 88 Fortunes total budget');return {win,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100}};
}

export function validateFireQueenPaidData(game:AGGameConfig,g:any):number {
 assert(game.gameId==='32767'&&game.dbName==='sg_fire_queen'&&game.sg?.runtimeGameId===32989&&game.sg?.header?.gameID==='20192'&&game.sg?.header?.gameCodeRGI==='firequeen_prt'&&game.sg?.logicRequestNode==='WagerInfo'&&game.sg?.fireQueenPaidContract==='fire-queen-own-paid-v1'&&game.sg?.betRaw===50,'AG integrity: SG Fire Queen binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Fire Queen schema');
 keys(g,'ReelResults|GameWinInfo|GameVariantInfo|stake|stakePerLine|paylineCount|totalWin|betID'+(g.WildTransformedReels!==undefined?'|WildTransformedReels':''));keys(g.ReelResults,'ReelSpin|numSpins');keys(g.GameWinInfo,'totalWagerWin|totalBGWin|totalFSWin|maxWinValue|isMaxWin|isEndGame');keys(g.GameVariantInfo,'rtp');
 assert(g.stake==='50'&&g.stakePerLine==='1'&&g.paylineCount==='100'&&g.GameVariantInfo.rtp==='95.95','AG integrity: SG Fire Queen wager');
 assert(g.GameWinInfo.isMaxWin==='N'&&g.GameWinInfo.isEndGame==='Y'&&g.GameWinInfo.totalFSWin==='0'&&g.GameWinInfo.maxWinValue==='25000000','AG integrity: SG Fire Queen actual feature requires mapping');
 const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Fire Queen spin count');const r=spins[0];
 keys(r,'ReelStops|spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded'+(r.PaylineWin?'|PaylineWin':''));
 integer(r.reelsetIndex,'Fire Queen reel set');assert(r.spinIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='N'&&r.winCountSC==='0','AG integrity: SG Fire Queen unclassified feature');
 assert(typeof r.ReelStops==='string'&&/^\d+(?:\|\d+)*$/.test(r.ReelStops),'AG integrity: SG Fire Queen reel stops');r.ReelStops.split('|').forEach((v:string)=>integer(v,'Fire Queen reel stop'));
 // Client parser consumes this paid-spin display list without another wager.
 if(g.WildTransformedReels!==undefined){
  assert(typeof g.WildTransformedReels==='string'&&(g.WildTransformedReels===''||/^\d+\|\d+(?:,\d+\|\d+)*$/.test(g.WildTransformedReels)),'AG integrity: SG Fire Queen transformed reel schema');
  const transformed=new Set<number>();
  for(const token of g.WildTransformedReels===''?[]:g.WildTransformedReels.split(',')){const [reel,symbol]=token.split('|').map((v:string)=>integer(v,'Fire Queen transformed display'));assert(reel<r.ReelStops.split('|').length&&!transformed.has(reel),'AG integrity: SG Fire Queen transformed reel range');transformed.add(reel);}
 }
 const wins=list(r.PaylineWin),seen=new Set<number>();assert(wins.length===integer(r.winCountPL,'Fire Queen line count'),'AG integrity: SG Fire Queen line count');let sum=0;
 for(const w of wins){keys(w,'#text|index|winVal|awardIndex|awardTableIndex');const i=integer(w.index,'Fire Queen line');assert(i<100&&!seen.has(i),'AG integrity: SG Fire Queen duplicate line');seen.add(i);integer(w.awardIndex,'Fire Queen award');integer(w.awardTableIndex,'Fire Queen award table');assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text']),'AG integrity: SG Fire Queen win positions');w['#text'].split('|').forEach((v:string)=>integer(v,'Fire Queen win position'));sum+=integer(w.winVal,'Fire Queen win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(r.spinWins,'Fire Queen spin win')&&sum===integer(g.totalWin,'Fire Queen root win')&&sum===integer(g.GameWinInfo.totalBGWin,'Fire Queen paid win')&&sum===integer(g.GameWinInfo.totalWagerWin,'Fire Queen cumulative win'),'AG integrity: SG Fire Queen monetary components');return sum;
}

export function validateGoldenChiefPaidData(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.betRaw===100&&['golden-chief-own-paid-v1','golden-chief-own-totem-v6'].includes(game.sg?.goldenChiefPaidContract),'AG integrity: SG Golden Chief binding');
 const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','PaylineCountInfo','SymbolUpgrade','WildExpansion']);assert(g&&typeof g==='object'&&!Array.isArray(g)&&Object.keys(g).every(k=>known.has(k)),'AG integrity: SG Golden Chief unknown paid data');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief schema');
 const positions=(v:any,max:number)=>{assert(typeof v==='string'&&/^\d+(?:\|\d+)*$/.test(v),'AG integrity: SG Golden Chief positions');const a=v.split('|').map((s:string)=>integer(s,'Golden Chief position'));assert(new Set(a).size===a.length&&a.every((n:number)=>n<max),'AG integrity: SG Golden Chief positions');return a;};
 keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');
 assert(g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0'&&g.BGInfo.baseGameSpinsRemaining==='0'&&!g.FSInfo,'AG integrity: SG Golden Chief actual feature requires mapping');
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=integer(g.PaylineCountInfo.activePaylineCount,'Golden Chief active paylines');
 assert(g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&[20,100].includes(active)&&integer(g.paylineCount,'Golden Chief paylines')===active&&g.stake==='100'&&g.stakePerLine==='5','AG integrity: SG Golden Chief paylines');
 keys(g.ReelResults,'numSpins|ReelSpin');assert(g.ReelResults.numSpins==='1','AG integrity: SG Golden Chief reel count');
 const spins=list(g.ReelResults.ReelSpin);assert(spins.length===1,'AG integrity: SG Golden Chief current spin');const spin=spins[0];
 assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='N'&&spin.winCountSC==='0'&&!spin.ScatterWin,'AG integrity: SG Golden Chief paid reel');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Golden Chief line count'),'AG integrity: SG Golden Chief line count');
 let sum=0;const indices=new Set<number>();for(const w of wins){const i=integer(w.index,'Golden Chief win index');assert(i<active&&!indices.has(i),'AG integrity: SG Golden Chief win index');indices.add(i);integer(w.awardIndex,'Golden Chief award');integer(w.awardTableIndex,'Golden Chief award table');positions(w['#text'],20);sum+=integer(w.winVal,'Golden Chief line win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(spin.spinWins,'Golden Chief spin win')&&sum===integer(g.totalWin,'Golden Chief total win')&&sum===integer(g.BGInfo.bgWinnings,'Golden Chief base win')&&sum===integer(g.BGInfo.totalWagerWin,'Golden Chief cumulative win'),'AG integrity: SG Golden Chief money');
 if(g.WildExpansion){keys(g.WildExpansion,'originalWildPositions|wildReels');const a=positions(g.WildExpansion.originalWildPositions,20),b=positions(g.WildExpansion.wildReels,5);assert(active===100&&a.every(n=>b.includes(n%5))&&b.every(n=>a.some(p=>p%5===n)),'AG integrity: SG Golden Chief wild columns');}else assert(active===20,'AG integrity: SG Golden Chief unbound extra paylines');
 if(g.SymbolUpgrade){keys(g.SymbolUpgrade,'replacementSymbol|positions');assert(active===100&&game.sg.goldenChiefUpgradeContract==='golden-chief-own-init-symbol-upgrade-v7'&&JSON.stringify(game.sg.goldenChiefUpgradeSymbolIds)===JSON.stringify([0,1,2,3,4,5,6,7,8,9,10])&&game.sg.goldenChiefUpgradeSymbolIds.includes(integer(g.SymbolUpgrade.replacementSymbol,'Golden Init replacement symbol')),'AG integrity: SG Golden Chief upgrade');positions(g.SymbolUpgrade.positions,20);}
}


// Actual own HTTP200 paid trigger + client's collect encoder. This is a pending
// selection, never a complete captured round or a synthetic free-spin result.

export function validateGoldenChiefBoardExtras(game:AGGameConfig,g:any,freeHorizontalExpansion=false):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief','AG integrity: SG Golden board binding');
 const keys=(v:any,n:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===n.split('|').sort().join('|'),'AG integrity: SG Golden board schema');
 const pos=(v:any,max:number)=>{assert(typeof v==='string'&&/^\d+(?:\|\d+)*$/.test(v),'AG integrity: SG Golden board positions');const a=v.split('|').map((n:string)=>integer(n,'Golden board position'));assert(new Set(a).size===a.length&&a.every((n:number)=>n<max),'AG integrity: SG Golden board positions');return a;};
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');assert(g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100','AG integrity: SG Golden Init board lines');const active=integer(g.PaylineCountInfo.activePaylineCount,'Golden board active');assert([20,100].includes(active),'AG integrity: SG Golden active lines');
 if(g.WildExpansion){keys(g.WildExpansion,'originalWildPositions|wildReels');const a=pos(g.WildExpansion.originalWildPositions,20),b=pos(g.WildExpansion.wildReels,5);assert(active===100&&a.every((n:number)=>b.includes(n%5))&&(freeHorizontalExpansion||b.every((n:number)=>a.some((p:number)=>p%5===n))),'AG integrity: SG Golden board wild columns');}else assert(active===20,'AG integrity: SG Golden missing expanded wild');
 if(g.SymbolUpgrade){keys(g.SymbolUpgrade,'replacementSymbol|positions');assert(active===100&&game.sg.goldenChiefUpgradeContract==='golden-chief-own-init-symbol-upgrade-v7'&&JSON.stringify(game.sg.goldenChiefUpgradeSymbolIds)===JSON.stringify([0,1,2,3,4,5,6,7,8,9,10])&&game.sg.goldenChiefUpgradeSymbolIds.includes(integer(g.SymbolUpgrade.replacementSymbol,'Golden own Init symbol')),'AG integrity: SG Golden board upgrade');pos(g.SymbolUpgrade.positions,20);}
 return active;
}

export function validateGoldenChiefGambleIntro(game:AGGameConfig,g:any):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.betRaw===100&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief gamble binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief gamble schema');
 const active=validateGoldenChiefBoardExtras(game,g);keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|GambleInfo'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));
 keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');
 assert(g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Chief alternate game');
 keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active,'AG integrity: SG Golden Chief gamble stake');
 keys(g.BonusWheel,'stopPosition');keys(g.GambleInfo,'previousFSCount|currentFSCount');
 assert(JSON.stringify(game.sg.goldenChiefWheelStrip)==JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0])&&JSON.stringify(game.sg.goldenChiefGambleCounts)==JSON.stringify([0,5,10,15,20,25,30]),'AG integrity: SG Golden Chief own Init contract');
 const stop=integer(g.BonusWheel.stopPosition,'Golden Chief wheel stop'),count=integer(g.GambleInfo.currentFSCount,'Golden Chief pending free count');
 assert(stop<game.sg.goldenChiefWheelStrip.length&&game.sg.goldenChiefWheelStrip[stop]===0&&count>0&&game.sg.goldenChiefGambleCounts.includes(count)&&g.GambleInfo.previousFSCount==='-1','AG integrity: SG Golden Chief wheel selection');
 keys(g.ReelResults,'numSpins|ReelSpin');assert(g.ReelResults.numSpins==='1','AG integrity: SG Golden Chief trigger reel count');const spins=list(g.ReelResults.ReelSpin);assert(spins.length===1,'AG integrity: SG Golden Chief trigger spin');const spin=spins[0];
 assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='Y'&&spin.winCountSC==='1','AG integrity: SG Golden Chief trigger flags');
 const scatter=spin.ScatterWin;assert(scatter&&scatter.winVal==='0'&&scatter.awardIndex==='0','AG integrity: SG Golden Chief trigger scatter');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Golden Chief line count'),'AG integrity: SG Golden Chief trigger lines');let sum=0;const seen=new Set<number>();
 for(const w of wins){const i=integer(w.index,'Golden Chief line index');assert(i<active&&!seen.has(i),'AG integrity: SG Golden Chief trigger index');seen.add(i);sum+=integer(w.winVal,'Golden Chief line win');}
 assert(Number.isSafeInteger(sum)&&sum===integer(spin.spinWins,'Golden Chief spin winnings')&&sum===integer(g.totalWin,'Golden Chief trigger total')&&sum===integer(g.BGInfo.totalWagerWin,'Golden Chief trigger cumulative')&&sum===integer(g.BGInfo.bgWinnings,'Golden Chief trigger base'),'AG integrity: SG Golden Chief trigger money');return count;
}


export function validateGoldenChiefCollectConfirmation(game:AGGameConfig,g:any,pending:{count:number;stop:string;baseWin:number},paidReels:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief collect binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief collect schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|BaseGameRecoveryInfo|GambleInfo');keys(g.BaseGameRecoveryInfo,'ReelResults|BGInfo|PaylineCountInfo|BonusWheel'+(g.BaseGameRecoveryInfo.WildExpansion?'|WildExpansion':'')+(g.BaseGameRecoveryInfo.SymbolUpgrade?'|SymbolUpgrade':''));const base=g.BaseGameRecoveryInfo;keys(base.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin');
 assert(pending&&paidReels&&g.stake==='100'&&g.stakePerLine==='5'&&g.paylineCount==='0'&&g.totalWin==='0','AG integrity: SG Golden Chief collect wager');
 assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(paidReels),'AG integrity: SG Golden Chief paid recovery bytes');
 keys(g.GambleInfo,'previousFSCount|currentFSCount|gambleFinished');keys(base.BonusWheel,'stopPosition');
 assert(integer(g.GambleInfo.previousFSCount,'Golden Chief previous collect')===pending.count&&integer(g.GambleInfo.currentFSCount,'Golden Chief confirmed collect')===pending.count&&g.GambleInfo.gambleFinished==='1'&&base.BonusWheel.stopPosition===pending.stop,'AG integrity: SG Golden Chief collect transition');
 assert(integer(base.BGInfo.bgWinnings,'Golden Chief collect base')===pending.baseWin&&integer(base.BGInfo.totalWagerWin,'Golden Chief collect total')===pending.baseWin&&base.BGInfo.baseGameSpinsRemaining==='0'&&base.BGInfo.isBigBet==='0'&&base.BGInfo.isMaxWin==='0','AG integrity: SG Golden Chief collect money');
 validateGoldenChiefBoardExtras(game,base);keys(base.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');assert(base.PaylineCountInfo.normalPaylineCount==='20'&&base.PaylineCountInfo.bonusPaylineCount==='100'&&[20,100].includes(integer(base.PaylineCountInfo.activePaylineCount,'Golden recovered lines')),'AG integrity: SG Golden Chief collect paylines');
}


export function validateGoldenChiefCanyon(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Chief Canyon binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Chief Canyon schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|CanyonBonus'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));keys(g.CanyonBonus,'canyonID|winAmount|steps');keys(g.BonusWheel,'stopPosition');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=validateGoldenChiefBoardExtras(game,g);const stop=integer(g.BonusWheel.stopPosition,'Canyon wheel stop');assert(JSON.stringify(game.sg.goldenChiefWheelStrip)===JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0])&&stop<12&&game.sg.goldenChiefWheelStrip[stop]===2,'AG integrity: SG Golden Chief Canyon wheel');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Chief Canyon wager');
 const canyon=integer(g.CanyonBonus.canyonID,'Canyon ID'),table=game.sg.goldenChiefCanyonPrizes2x;
 assert(game.sg.goldenChiefCanyonTrailContract==='golden-chief-own-init-canyon-trails-v12'&&Array.isArray(table)&&table.length===10&&table.every((row:any)=>Array.isArray(row)&&row.length===24&&row.every((p:any)=>Number.isSafeInteger(p)&&p>0))&&canyon<table.length,'AG integrity: SG Golden Chief Canyon Init path');
 const text=g.CanyonBonus.steps;assert(typeof text==='string'&&/^(?:[1-6]\|)+-(?:1|2)$/.test(text),'AG integrity: SG Golden Chief completed Canyon display steps');
 // SDK starts before the trail. Each positive wheel step advances one cell
 // at a time; either declared negative wheel segment leaves the position alone.
 let position=-1;for(const move of text.split('|').slice(0,-1)){position+=integer(move,'Canyon move');assert(position>=0&&position<table[canyon].length,'AG integrity: SG Golden Chief Canyon trail overflow');}
 const displayPrize=table[canyon][position]*game.sg.betRaw/2;
 assert(Number.isSafeInteger(displayPrize)&&displayPrize===integer(g.CanyonBonus.winAmount,'Canyon derived award'),'AG integrity: SG Golden Chief Canyon own Init payout');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden Chief Canyon reel');const spin=spins[0];assert(spin.spinIndex==='0'&&spin.reelsetIndex==='0'&&spin.freeSpin==='N'&&spin.bonusAwarded==='Y'&&spin.winCountSC==='1'&&spin.ScatterWin?.winVal==='0'&&spin.ScatterWin?.awardIndex==='0','AG integrity: SG Golden Chief Canyon flags');
 const wins=list(spin.PaylineWin);assert(wins.length===integer(spin.winCountPL,'Canyon line count'),'AG integrity: SG Golden Chief Canyon lines');let lines=0;for(const w of wins)lines+=integer(w.winVal,'Canyon line win');const prize=integer(g.CanyonBonus.winAmount,'Canyon prize');assert(Number.isSafeInteger(lines+prize)&&lines===integer(spin.spinWins,'Canyon reel win')&&lines+prize===integer(g.totalWin,'Canyon total')&&lines+prize===integer(g.BGInfo.bgWinnings,'Canyon base')&&lines+prize===integer(g.BGInfo.totalWagerWin,'Canyon cumulative'),'AG integrity: SG Golden Chief Canyon monetary components');
}


export function validateGoldenChiefFree(game:AGGameConfig,g:any,prior:any,pending:any,paidReels:any,priorWin:number):number {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden free binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden free schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BaseGameRecoveryInfo|PaylineCountInfo|FSInfo'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));
 keys(g.FSInfo,'fsWinnings|freeSpinsTotal|freeSpinNumber|freespinsAwarded|isMaxWin');keys(g.BaseGameRecoveryInfo,'ReelResults|BGInfo|PaylineCountInfo|BonusWheel'+(g.BaseGameRecoveryInfo.WildExpansion?'|WildExpansion':'')+(g.BaseGameRecoveryInfo.SymbolUpgrade?'|SymbolUpgrade':''));
 const b=g.BaseGameRecoveryInfo;keys(b.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(b.BonusWheel,'stopPosition');
 assert(prior&&pending&&Number.isSafeInteger(priorWin)&&JSON.stringify(b.ReelResults)===JSON.stringify(paidReels),'AG integrity: SG Golden free recovery bytes');
 assert(game.sg.goldenChiefFreeContract==='golden-chief-own-free-state-v10','AG integrity: SG Golden free state contract');
 assert(integer(b.BGInfo.bgWinnings,'Golden recovered base')===pending.baseWin&&b.BonusWheel.stopPosition===pending.stop&&b.BGInfo.baseGameSpinsRemaining==='0'&&b.BGInfo.isBigBet==='0'&&b.BGInfo.isMaxWin==='0'&&b.BGInfo.chiefWin==='0','AG integrity: SG Golden free base state');
 // The client renders horizontal expansion from returned wildReels. A free
 // expansion can span columns without an original wild in each column.
 const active=validateGoldenChiefBoardExtras(game,g,true);validateGoldenChiefBoardExtras(game,b);
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.FSInfo.isMaxWin==='0','AG integrity: SG Golden free wager');
 const played=integer(g.FSInfo.freeSpinNumber,'Golden played'),total=integer(g.FSInfo.freeSpinsTotal,'Golden total'),awarded=integer(g.FSInfo.freespinsAwarded,'Golden awarded');
 assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+awarded&&played<=total,'AG integrity: SG Golden free transition');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden free reel');const r=spins[0];
 assert(r.spinIndex==='0'&&integer(r.reelsetIndex,'Golden free Init set')>=5&&integer(r.reelsetIndex,'Golden free Init set')<=14&&r.freeSpin==='Y','AG integrity: SG Golden free flags');
 if(awarded>0){
  assert(r.bonusAwarded==='Y'&&r.winCountSC==='1','AG integrity: SG Golden retrigger flags');
  keys(r.ScatterWin,'#text|winVal|awardIndex');assert(r.ScatterWin.winVal==='0'&&r.ScatterWin.awardIndex==='0','AG integrity: SG Golden free scatter');
 }else assert(r.bonusAwarded==='N'&&r.winCountSC==='0'&&r.ScatterWin===undefined,'AG integrity: SG Golden non-retrigger flags');
 const wins=list(r.PaylineWin);assert(wins.length===integer(r.winCountPL,'Golden free line count'),'AG integrity: SG Golden free lines');let win=0;const seen=new Set<number>();
 for(const w of wins){const index=integer(w.index,'Golden line');assert(index<active&&!seen.has(index),'AG integrity: SG Golden duplicate line');seen.add(index);integer(w.awardIndex,'Golden award');integer(w.awardTableIndex,'Golden table');assert(typeof w['#text']==='string'&&/^\d+(?:\|\d+)*$/.test(w['#text'])&&w['#text'].split('|').every((v:string)=>integer(v,'Golden symbol position')<20),'AG integrity: SG Golden positions');win+=integer(w.winVal,'Golden line amount');}
 const freeWin=integer(g.FSInfo.fsWinnings,'Golden free winnings');assert(Number.isSafeInteger(win)&&win===integer(r.spinWins,'Golden spin amount')&&win===integer(g.totalWin,'Golden current total')&&pending.baseWin+freeWin===priorWin+win,'AG integrity: SG Golden free monetary components');
 assert(Number.isSafeInteger(pending.baseWin+freeWin)&&integer(b.BGInfo.totalWagerWin,'Golden recovered cumulative wager')===pending.baseWin+freeWin,'AG integrity: SG Golden cumulative recovery money');return pending.baseWin+freeWin;
}


export function validateGoldenChiefTotem(game:AGGameConfig,g:any):void {
 assert(game.gameId==='32771'&&game.dbName==='sg_golden_chief'&&game.sg?.runtimeGameId===32993&&game.sg?.header?.gameID==='20125'&&game.sg?.header?.gameCodeRGI==='goldenchief'&&game.sg?.goldenChiefPaidContract==='golden-chief-own-totem-v6','AG integrity: SG Golden Totem binding');
 const keys=(v:any,names:string)=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===names.split('|').sort().join('|'),'AG integrity: SG Golden Totem schema');
 keys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|PaylineCountInfo|BonusWheel|TotemBonus'+(g.WildExpansion?'|WildExpansion':'')+(g.SymbolUpgrade?'|SymbolUpgrade':''));keys(g.TotemBonus,'gameMode|totemType|numLives|winAmount|steps');keys(g.BonusWheel,'stopPosition');keys(g.BGInfo,'totalWagerWin|bgWinnings|baseGameSpinsRemaining|isBigBet|isMaxWin|chiefWin');keys(g.PaylineCountInfo,'normalPaylineCount|bonusPaylineCount|activePaylineCount');
 const active=validateGoldenChiefBoardExtras(game,g);const stop=integer(g.BonusWheel.stopPosition,'Totem wheel stop');assert(stop<12&&game.sg.goldenChiefWheelStrip[stop]===1&&JSON.stringify(game.sg.goldenChiefWheelStrip)===JSON.stringify([1,0,1,2,1,0,1,0,1,2,1,0]),'AG integrity: SG Golden Totem wheel');
 assert(g.stake==='100'&&g.stakePerLine==='5'&&integer(g.paylineCount,'Golden current paylines')===active&&g.PaylineCountInfo.normalPaylineCount==='20'&&g.PaylineCountInfo.bonusPaylineCount==='100'&&integer(g.PaylineCountInfo.activePaylineCount,'Golden active')===active&&g.BGInfo.baseGameSpinsRemaining==='0'&&g.BGInfo.isBigBet==='0'&&g.BGInfo.isMaxWin==='0'&&g.BGInfo.chiefWin==='0','AG integrity: SG Golden Totem wager');
 assert(game.sg.goldenChiefTotemLifeContract==='golden-chief-own-init-trails-lives-v11'&&g.TotemBonus.gameMode==='1'&&['0','1'].includes(g.TotemBonus.totemType)&&typeof g.TotemBonus.steps==='string'&&/^(?:[012]|-2)(?:\|(?:[012]|-2))*$/.test(g.TotemBonus.steps),'AG integrity: SG Golden completed Totem display scope');
 const trails=game.sg.goldenChiefTotemTrails?.[g.TotemBonus.totemType],lives=integer(g.TotemBonus.numLives,'Totem extra lives');
 assert(Array.isArray(trails)&&trails.length===3&&trails.every((a:any)=>Array.isArray(a)&&a.length===15&&a.every((v:any)=>Number.isSafeInteger(v)&&v>=0))&&lives<=2,'AG integrity: SG Golden own Init Totem trail/life bounds');
 const picks=g.TotemBonus.steps.split('|').map(Number);let position=-1,spent=0,displayWin=0,terminal=false;
 for(let i=0;i<picks.length;i++){
  const pick=picks[i];assert(!terminal,'AG integrity: SG Golden Totem data after terminal');
  if(i===0||picks[i-1]>=0)position++;
  assert(position>=0&&position<trails[0].length,'AG integrity: SG Golden Totem trail position');
  if(pick<0){assert(i>0&&++spent<=lives,'AG integrity: SG Golden Totem life budget');}
  else if(pick===2&&i>0)terminal=true;
  else {displayWin=trails[pick][position]*game.sg.betRaw;assert(Number.isSafeInteger(displayWin),'AG integrity: SG Golden Totem prize overflow');terminal=position===trails[pick].length-1;}
 }
 assert(terminal&&displayWin===integer(g.TotemBonus.winAmount,'Totem declared prize'),'AG integrity: SG Golden Totem Init-derived prize');
 keys(g.ReelResults,'numSpins|ReelSpin');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Golden Totem reel');const r=spins[0];assert(r.spinIndex==='0'&&r.reelsetIndex==='0'&&r.freeSpin==='N'&&r.bonusAwarded==='Y'&&r.winCountSC==='1'&&r.ScatterWin?.winVal==='0'&&r.ScatterWin?.awardIndex==='0','AG integrity: SG Golden Totem flags');
 const wins=list(r.PaylineWin);assert(wins.length===integer(r.winCountPL,'Totem line count'),'AG integrity: SG Golden Totem lines');let sum=0;const seen=new Set<number>();for(const w of wins){const i=integer(w.index,'Totem line');assert(i<active&&!seen.has(i),'AG integrity: SG Golden Totem line index');seen.add(i);sum+=integer(w.winVal,'Totem line win');}const prize=integer(g.TotemBonus.winAmount,'Totem prize');assert(Number.isSafeInteger(sum+prize)&&sum===integer(r.spinWins,'Totem spin money')&&sum+prize===integer(g.totalWin,'Totem total')&&sum+prize===integer(g.BGInfo.bgWinnings,'Totem base')&&sum+prize===integer(g.BGInfo.totalWagerWin,'Totem cumulative'),'AG integrity: SG Golden Totem monetary components');
}

export function validateDragonWildInfo(game: AGGameConfig, result: any): void {
    assert(game.gameId === '32764' && game.dbName === 'sg_dragon_spin'
        && game.sg?.runtimeGameId === 32986 && game.sg?.runtimeSlug === 'dragon-spin'
        && game.sg?.header?.gameCodeRGI === 'dragonspin' && game.sg?.header?.gameID === '20117'
        && game.sg?.wildPositionContract === 'dragon-5x3-positions-v1', 'AG integrity: SG Dragon wild binding');
    const feature = integer(result.FSInfo?.featureIndex, 'Dragon wild feature');
    assert(feature === 1 || feature === 2, 'AG integrity: SG Dragon wild feature not mapped');
    const allowed = feature === 1 ? ['WildPos'] : ['NewWildPos', 'OldWildPos'];
    const wild = result.WildInfo === '' ? {} : result.WildInfo;
    assert(wild && typeof wild === 'object' && !Array.isArray(wild)
        && Object.keys(wild).every(key => allowed.includes(key)), 'AG integrity: SG Dragon wild schema');
    const seen = new Set<number>();
    for (const key of Object.keys(wild)) {
        const text = wild[key];
        assert(typeof text === 'string' && (text === '' || /^(?:0|[1-9]\d*)(?:\|(?:0|[1-9]\d*))*$/.test(text)),
            'AG integrity: SG Dragon wild positions');
        for (const value of text === '' ? [] : text.split('|')) {
            const position = integer(value, 'Dragon wild position');
            assert(position < 15 && !seen.has(position), 'AG integrity: SG Dragon wild board position');
            seen.add(position);
        }
    }
}

// Himalaya's exact frontend sends the same Logic request while existing
// free counters have remaining spins. Compass animation uses the already
// returned result. Winning/fully charged branches need their own mapped data.
export function validateHimalayaCompass(game:AGGameConfig,result:any,previousFree?:Record<string,any>):void {
    assert(game.gameId==='32774' && game.dbName==='sg_himalayas_roof_of_the_world'
        && game.sg?.header?.gameCodeRGI==='himalayas' && game.sg?.header?.gameID==='20230'
        && game.sg?.runtimeGameId===32996 && game.sg?.runtimeSlug==='himalayas--roof-of-the-world'
        && game.sg?.compassContract==='himalaya-existing-free-compass-v4','AG integrity: SG Himalaya compass binding');
    const c=result.Compass,f=result.FSInfo;
    assert(c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).sort().join('|')==='compasPiecesFoundThisSpin|percentFull|pickChoices|pickValueAward|wonGamble','AG integrity: SG Himalaya compass schema');
    const percent=integer(c.percentFull,'Himalaya compass percent'),pieces=integer(c.compasPiecesFoundThisSpin,'Himalaya compass pieces');
    assert(percent<=100&&percent%20===0&&pieces<=4,'AG integrity: SG Himalaya compass geometry');
    assert(c.pickChoices==='5|7|10|12|20','AG integrity: SG Himalaya award choices changed');
    assert(f&&integer(f.freeSpinNumber,'Himalaya played')<=integer(f.freeSpinsTotal,'Himalaya total'),'AG integrity: SG Himalaya missing free counters');
    const remaining=integer(f.freeSpinsTotal,'Himalaya total')-integer(f.freeSpinNumber,'Himalaya played');
    // Exact own SDK getBoolean maps -1 and 0 to false, 1 to true.
    // Permit only the observed pending branch and the SDK's losing terminal.
    const pending=remaining>0&&c.wonGamble==='-1'&&c.pickValueAward==='-1'&&percent<=80;
    const lost=remaining===0&&c.wonGamble==='0'&&c.pickValueAward==='-2'&&percent<=80;
    // The exact SDK consumes the returned Compass award and continues Logic;
    // Group-end awards and fully charged mid-group awards were returned naturally.
    // The latter preserves unplayed old spins and adds the returned award once.
    // No pick HTTP request is sent, no free counters or money are invented.
    let won=false;
    if(c.wonGamble==='1') {
        const award=integer(c.pickValueAward,'Himalaya awarded free spins');
        const played=integer(f.freeSpinNumber,'Himalaya awarded played'),total=integer(f.freeSpinsTotal,'Himalaya awarded total');
        won=!!previousFree&&[5,7,10,12,20].includes(award)
            &&played===previousFree.freeSpinsPlayed+1&&played<=previousFree.freeSpinsTotal
            &&(played===previousFree.freeSpinsTotal||percent===100)
            &&total===previousFree.freeSpinsTotal+award
            &&remaining===previousFree.freeSpinsTotal-played+award;
    }
    assert(pending||lost||won,'AG integrity: SG Himalaya compass transition not mapped');
    assert(integer(result.BGInfo.baseGameSpinsRemaining,'Himalaya base remaining')===0,'AG integrity: SG Himalaya base continuation not mapped');
}

// Shared returned-cash decoder, bound to these three independently evidenced
// connections. It translates SG data; original AG still controls every action.
function ownHealthyComponentsBinding(game:AGGameConfig):'megaways'|'deepsea'|'jinji'|'spartacus' {
 const bindings:any={
  '32807':['sg_spartacusmegaways',33167,'20405','spartacusmegaways',200,'spartacus-own-returned-components-v2','spartacus'],
  '32751':['sg_eightyeightfortunesmegaways',32973,'20371','eightyeightfortunesmegaways',16,'eighty-eight-megaways-own-components-v4','megaways'],
  '32765':['sg_dropandlockdeepseamagic',32987,'20412','dropandlockdeepseamagic',200,'deep-sea-own-line-free-components-v1','deepsea'],
  '32777':['sg_jjbxmegaways',32999,'20468','jjbxmegaways',88,'jin-ji-megaways-own-paid-components-v1','jinji']
 };
 const b=bindings[game.gameId];assert(b&&game.dbName===b[0]&&game.sg.runtimeGameId===b[1]&&game.sg.header.gameID===b[2]&&game.sg.header.gameCodeRGI===b[3]&&game.sg.betRaw===b[4]&&game.sg.healthyComponentsContract===b[5],'AG integrity: SG healthy component connection');return b[6];
}
function ownHealthyTopReel(top:any,kind?:string) {
 ownPaidKeys(top,'reelSetIndex|reelStop|positions','healthy top reel');integer(top.reelSetIndex,'top set');integer(top.reelStop,'top stop');
 assert(JSON.stringify(ownPositionNumbers(top.positions,4,'top positions'))===JSON.stringify(kind==='spartacus'?[55,56,57,58]:[37,38,39,40]),'AG integrity: SG top positions');
}
function ownHealthyReelCash(reels:any,kind:string,isFree:boolean,hasIntro:boolean):number {
 ownPaidKeys(reels,'numSpins|ReelSpin'+(kind==='spartacus'?'|CurtainInfo':''),'healthy reels');const spins=list(reels.ReelSpin);
 assert(spins.length===integer(reels.numSpins,'healthy cascade count')&&spins.length>0,'AG integrity: SG healthy cascade count');
 if(kind==='spartacus'){
  const curtains=list(reels.CurtainInfo);assert(curtains.length===spins.length,'AG integrity: SG Spartacus paired curtains');
  for(const [i,c] of curtains.entries()){ownPaidKeys(c,'spinIndex|heights','Spartacus curtain');assert(integer(c.spinIndex,'Spartacus curtain index')===i&&ownPositionNumbers(c.heights,6,'Spartacus curtain heights').every(n=>n<=10),'AG integrity: SG Spartacus curtain geometry');}
 }
 let cash=0;
 for(const [i,s] of spins.entries()) {
  const deep=kind==='deepsea',wins=list(deep?s.PaylineWin:s.AnywayWin),scatters=list(s.ScatterWin);
  const names=deep?'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops':'spinIndex|reelsetIndex|anywayWins|scatterWinCount|totalSpinWin|freeSpin|bonusAwarded|ReelStops';
  ownPaidKeys(s,names+(wins.length?(deep?'|PaylineWin':'|AnywayWin'):'')+(scatters.length?'|ScatterWin':''),'healthy reel spin');
  assert(integer(s.spinIndex,'healthy spin index')===i&&s.freeSpin===(isFree?'Y':'N')&&['Y','N'].includes(s.bonusAwarded),'AG integrity: SG healthy spin state');
  assert(hasIntro||s.bonusAwarded==='N','AG integrity: SG healthy unmapped bonus');integer(s.reelsetIndex,'healthy reel set');ownPositionNumbers(s.ReelStops,deep?5:6,'healthy reel stops');
  assert(integer(deep?s.winCountPL:s.anywayWins,'healthy ways count')===wins.length&&integer(deep?s.winCountSC:s.scatterWinCount,'healthy scatter count')===scatters.length,'AG integrity: SG healthy award count');
  let lines=0,scatter=0;
  for(const [j,w] of wins.entries()) {
   ownPaidKeys(w,deep?'index|winVal|awardIndex|awardTableIndex|#text':'winIndex|winVal|ways|awardIndex|#text','healthy cash award');
   if(deep){assert(integer(w.index,'payline index')<50,'AG integrity: SG payline index');integer(w.awardTableIndex,'award table');}
   else assert(integer(w.winIndex,'ways index')===j&&integer(w.ways,'ways')>0,'AG integrity: SG ways index');
   integer(w.awardIndex,'healthy award index');assert(ownPositionNumbers(w['#text'],undefined,'healthy winning positions').every(n=>n<(deep?15:kind==='spartacus'?6*10:kind==='megaways'?6*7:41)),'AG integrity: SG healthy position range');lines+=integer(w.winVal,'healthy line cash');
  }
  for(const w of scatters) {
   ownPaidKeys(w,'winVal|awardIndex'+(w['#text']!==undefined?'|#text':''),'healthy scatter');integer(w.awardIndex,'scatter award');
   if(w['#text']!==undefined)assert(ownPositionNumbers(w['#text'],undefined,'scatter positions').every(n=>n<(deep?15:kind==='spartacus'?6*10:kind==='megaways'?6*7:41)),'AG integrity: SG scatter range');scatter+=integer(w.winVal,'scatter cash');
  }
  assert(lines===integer(deep?s.spinWins:s.totalSpinWin,'healthy returned line cash'),'AG integrity: SG healthy line cash disagreement');cash+=lines+scatter;assert(Number.isSafeInteger(cash),'AG integrity: SG unsafe healthy cash');
 }
 return cash;
}
export function validateOwnHealthyComponents(game:AGGameConfig,g:any,first:boolean,previousFree:any,base:any,previousWin:number) {
 const kind=ownHealthyComponentsBinding(game),deep=kind==='deepsea',hasFree=g?.FSInfo!==undefined;
 assert(first||kind!=='jinji','AG integrity: SG Jin Ji new free branch needs own evidence');
 const names='stake|totalWin|betID|ReelResults|BGInfo'+(deep?'|stakePerLine|paylineCount':'|TopReelInfo')+(g?.BonusSymValues!==undefined?'|BonusSymValues':'')+(hasFree?'|FSInfo':'')+(g?.PickerInfo!==undefined?'|PickerInfo':'')+(!first?'|BaseGameRecoveryInfo'+(deep?'|MultiplierInfo':'|CascadeInfo'):'');
 ownPaidKeys(g,names,'healthy component result');assert(integer(g.stake,'healthy stake')===game.sg.betRaw&&typeof g.betID==='string','AG integrity: SG healthy wager');
 if(deep)assert(g.stakePerLine==='4'&&g.paylineCount==='50','AG integrity: SG Deep Sea wager');else ownHealthyTopReel(g.TopReelInfo,kind);
 if(g.BonusSymValues!==undefined){assert(deep&&typeof g.BonusSymValues==='string'&&/^(?:-1|\d+)(?:\|(?:-1|\d+))*$/.test(g.BonusSymValues),'AG integrity: SG Deep Sea bonus display');const vals=g.BonusSymValues.split('|');assert(vals.length===15&&vals.every((v:string)=>v==='-1'||Number.isSafeInteger(Number(v))),'AG integrity: SG Deep Sea display geometry');}
 ownPaidKeys(g.BGInfo,'totalWagerWin|bgWinnings|isMaxWin'+(deep?'':kind==='megaways'?'|gameMode|reelHeights':'|reelHeights'),'healthy base info');assert(g.BGInfo.isMaxWin==='0','AG integrity: SG healthy capped result');
 if(kind==='megaways')assert(g.BGInfo.gameMode==='0','AG integrity: SG 88 game mode');
 if(!deep)assert(ownPositionNumbers(g.BGInfo.reelHeights,6,'base reel heights').every(n=>n>=2&&n<=(kind==='spartacus'?10:7)),'AG integrity: SG base heights');
 // The returned award is a state transition, not another cash payout.
 // Own closed prefixes include zero/nonzero winnings and 6/8/12 new spins.
 // Preserve unplayed spins, consume exactly one old spin, add only the award.
 const ownFreeRetrigger=!first&&hasFree&&(kind==='megaways'||kind==='spartacus')&&integer(g.FSInfo.extraSpinsAwarded,'own returned extra free spins')>0;
 if(!first&&(kind==='megaways'||kind==='spartacus')) {
  const spins=list(g.ReelResults.ReelSpin),marked=spins.map((r:any,i:number)=>({r,i})).filter((q:any)=>q.r.bonusAwarded==='Y');
  assert(marked.length===(ownFreeRetrigger?1:0),'AG integrity: SG free award flag disagreement');
  if(ownFreeRetrigger) {
   const award=integer(g.FSInfo.extraSpinsAwarded,'own actual free award');
   assert(previousFree&&integer(g.FSInfo.freeSpinNumber,'own award played')===previousFree.freeSpinsPlayed+1&&integer(g.FSInfo.freeSpinsTotal,'own awarded total')===previousFree.freeSpinsTotal+award,'AG integrity: SG free award counter transition');
   assert(marked[0].i===spins.length-1&&integer(marked[0].r.scatterWinCount,'own award scatter count')>0,'AG integrity: SG free award cascade order');
  }
 }
 const current=ownHealthyReelCash(g.ReelResults,kind,!first,(first&&hasFree)||ownFreeRetrigger),win=integer(g.BGInfo.totalWagerWin,'healthy cumulative'),bg=integer(g.BGInfo.bgWinnings,'healthy paid cash');
 assert(integer(g.totalWin,'healthy current cash')===current&&win===(first?current:previousWin+current),'AG integrity: SG healthy current cumulative cash');
 if(first){assert(bg===current&&previousFree===undefined,'AG integrity: SG healthy paid entry');base=structuredClone(g);}
 else {
  assert(previousFree&&base&&hasFree&&bg===integer(base.BGInfo.bgWinnings,'original paid cash'),'AG integrity: SG healthy free entry retained');
  ownPaidKeys(g.BaseGameRecoveryInfo,deep?'ReelResults':'ReelResults|TopReelInfo','healthy paid recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG healthy original reels changed');
  if(!deep){assert(JSON.stringify(g.BaseGameRecoveryInfo.TopReelInfo)===JSON.stringify(base.TopReelInfo)&&g.BGInfo.reelHeights===base.BGInfo.reelHeights,'AG integrity: SG healthy paid top/height recovery');}
  if(deep){ownPaidKeys(g.MultiplierInfo,'currentMultiplier|multList','Deep Sea multiplier');const mult=integer(g.MultiplierInfo.currentMultiplier,'Deep Sea multiplier');assert(mult>0&&ownPositionNumbers(g.MultiplierInfo.multList,undefined,'Deep Sea multiplier list').includes(mult),'AG integrity: SG Deep Sea multiplier display');}
 }
 if(!hasFree){assert(first&&g.PickerInfo===undefined&&bg===win,'AG integrity: SG healthy free state disappeared');return {win,free:undefined,base};}
 assert(kind!=='jinji','AG integrity: SG Jin Ji free scope not evidenced');
 const f=g.FSInfo;ownPaidKeys(f,first?(deep?'fsWinnings|freeSpinsTotal|freeSpinNumber':kind==='spartacus'?'fsWinnings|freeSpinsTotal|freeSpinNumber|extraSpinsAwarded|curtainIndex'+(g.FSInfo.startCasMult!==undefined?'|startCasMult':''):'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin|startCasMult'):(deep?'fsWinnings|freeSpinsTotal|freeSpinNumber|isMaxWin|extraSpinsAwarded':'fsWinnings|freeSpinsTotal|freeSpinNumber|extraSpinsAwarded|reelHeights'),'healthy free info');
 const total=integer(f.freeSpinsTotal,'healthy free total'),played=integer(f.freeSpinNumber,'healthy free played'),freeWin=integer(f.fsWinnings,'healthy free cash');assert(total>0&&played<=total&&bg+freeWin===win,'AG integrity: SG healthy free components');
 if(f.isMaxWin!==undefined)assert(f.isMaxWin==='0','AG integrity: SG healthy free cap');
 if(first){assert(played===0&&freeWin===0,'AG integrity: SG healthy free intro');if(kind==='spartacus'){assert(g.PickerInfo===undefined&&integer(f.extraSpinsAwarded,'Spartacus paid free award')===0&&JSON.stringify(game.sg.spartacusCurtainIndices)===JSON.stringify([0,1,2,3,4,5])&&game.sg.spartacusCurtainIndices.includes(integer(f.curtainIndex,'Spartacus returned curtain')),'AG integrity: SG Spartacus free introduction');if(f.startCasMult!==undefined)assert(integer(f.startCasMult,'Spartacus initial multiplier')>0,'AG integrity: SG Spartacus initial multiplier');}else if(!deep){if(g.PickerInfo!==undefined){ownPaidKeys(g.PickerInfo,'pickerIndex','88 picker display');integer(g.PickerInfo.pickerIndex,'88 returned picker index');}assert(integer(f.startCasMult,'88 initial multiplier')>0,'AG integrity: SG 88 server free introduction');}}
 else {
  const award=integer(f.extraSpinsAwarded,'healthy awarded extra spins');assert(played===previousFree.freeSpinsPlayed+1&&total===previousFree.freeSpinsTotal+award,'AG integrity: SG healthy free counter transition');
  if(!deep){assert(g.PickerInfo===undefined&&ownPositionNumbers(f.reelHeights,6,'free heights').every(n=>n>=2&&n<=(kind==='spartacus'?10:7)),'AG integrity: SG healthy free heights');ownPaidKeys(g.CascadeInfo,'prevCascadeMult|curCascadeMult','88 cascade multiplier');const prior=integer(g.CascadeInfo.prevCascadeMult,'88 prior multiplier'),next=integer(g.CascadeInfo.curCascadeMult,'88 current multiplier');assert(prior===(previousFree.ownCascadeMultiplier??(kind==='spartacus'&&base.FSInfo.startCasMult===undefined?1:integer(base.FSInfo.startCasMult,'own initial multiplier')))&&next===prior+list(g.ReelResults.ReelSpin).length-1,'AG integrity: SG 88 cascade transition');}
 }
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100,...(['megaways','spartacus'].includes(kind)?{ownCascadeMultiplier:first?(kind==='spartacus'&&f.startCasMult===undefined?1:integer(f.startCasMult,'own initial multiplier')):integer(g.CascadeInfo.curCascadeMult,'own current multiplier')}:{})}};
}

export function sgRequestTimeoutMs(game: AGGameConfig): number {
    const value=game.sg?.requestTimeoutMs === undefined ? 30000 : game.sg.requestTimeoutMs;
    assert(Number.isSafeInteger(value) && value>=1000 && value<=120000,'AG integrity: SG request timeout binding');
    return value;
}
export function sgTransportDiagnostic(error: unknown, start: number, deadline: number, now=Date.now(), responseStatus?: number) {
    const e=error && typeof error==='object' ? error as any : undefined;
    const safeName=(v:unknown)=>typeof v==='string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v) ? v : undefined;
    const safeCode=(v:unknown)=>typeof v==='string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(v) ? v : undefined;
    const elapsed=Number.isSafeInteger(start)&&Number.isSafeInteger(now)&&now>=start ? now-start : undefined;
    return {errorName:safeName(e?.name),causeName:safeName(e?.cause?.name),causeCode:safeCode(e?.cause?.code),
        elapsedMs:elapsed,configuredTimeoutMs:deadline,
        responseHeadersReceived:responseStatus!==undefined,
        ...(responseStatus!==undefined ? {responseStatusBeforeBodyFailed:responseStatus} : {}),
        completeResponseCaptured:false,serverApplicationOutcomeProven:false};
}


export function validateSpiritRiver(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number) {
 assert(game.gameId==='32808'&&game.dbName==='sg_spiritoftheriver'&&game.sg.runtimeGameId===33168&&game.sg.header.gameID==='20470'&&game.sg.header.gameCodeRGI==='spiritoftheriver'&&game.sg.betRaw===200&&game.sg.spiritRiverContract==='spirit-river-own-cash-progress-irf-v1','AG integrity: SG own River binding');
 ownPaidKeys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|BGInfo|ProgressInfo'+(first?'':'|BaseGameRecoveryInfo|FSInfo|IRFInfo')+(first&&g.FSInfo!==undefined?'|FSInfo':''),'River result');
 assert(g.stake==='200'&&g.stakePerLine==='10'&&g.paylineCount==='0'&&typeof g.betID==='string','AG integrity: SG River source wager');
 ownPaidKeys(g.BGInfo,'totalWagerWin|bgWinnings|isMaxWin','River base');assert(g.BGInfo.isMaxWin==='0','AG integrity: SG River cap');
 const vector=(s:any,n:number,label:string)=>ownPositionNumbers(s,n,label);
 ownPaidKeys(g.ProgressInfo,'prevSeriesSpinIndex|seriesSpinIndex|prevScatterCollected|scattersCollected','River own per-stake progress');
 for(const k of ['prevSeriesSpinIndex','seriesSpinIndex','prevScatterCollected','scattersCollected'])vector(g.ProgressInfo[k],21,'River progress '+k);
 let free,expansions:number[]|undefined,multiplier=1;
 if(first){
  assert(prior===undefined,'AG integrity: SG River old free state at paid start');base=structuredClone(g);
  // Bootstrap Stakes.count=21. These arrays are returned per-stake display,
  // not an additional prize or another request; every source byte is retained.
 }else{
  assert(prior&&base&&g.FSInfo,'AG integrity: SG River missing real free state');ownPaidKeys(g.BaseGameRecoveryInfo,'ReelResults','River paid recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG River original paid bytes');
  ownPaidKeys(g.FSInfo,'fsWinnings|freeSpinsTotal|freeSpinNumber|previousReelExpansions|scattersCollected|extraSpinsAwarded|numWays','River free');
  expansions=vector(g.FSInfo.previousReelExpansions,6,'River previous expansions');assert(expansions.every(v=>v<=2),'AG integrity: SG River expansion range');
  if(prior.ownRiverExpansions)assert(JSON.stringify(expansions)===JSON.stringify(prior.ownRiverExpansions),'AG integrity: SG River previous expansions changed');
  else assert(prior.freeSpinsPlayed===0&&expansions.every(v=>v===0),'AG integrity: SG River initial expansion state');
  integer(g.FSInfo.scattersCollected,'River returned free scatter count');assert(integer(g.FSInfo.numWays,'River returned ways')>0,'AG integrity: SG River ways');
  const irf=g.IRFInfo,index=integer(irf.featureIndex,'River returned IRF index');assert([1,2,3,4].includes(index),'AG integrity: SG River unknown IRF');
  if(index===1){ownPaidKeys(irf,'featureIndex|newReelExpansions','River expansion IRF');const next=vector(irf.newReelExpansions,6,'River new expansions');assert(next.every((v,i)=>v>=expansions![i]&&v<=2),'AG integrity: SG River expansion transition');expansions=next;}
  else if(index===2){ownPaidKeys(irf,'featureIndex|mysteryPosition|mysterySymbol','River mystery IRF');if(irf.mysteryPosition===''){assert(game.sg.spiritRiverEmptyMysteryContract==='own-returned-empty-mystery-display-v2','AG integrity: SG River own empty display contract');}else vector(irf.mysteryPosition,undefined,'River typed mystery positions');integer(irf.mysterySymbol,'River mystery symbol');}
  else if(index===3){ownPaidKeys(irf,'featureIndex|wildPosition','River wild IRF');vector(irf.wildPosition,undefined,'River typed wild positions');}
  else{ownPaidKeys(irf,'featureIndex|bearMultiplier','River bear IRF');multiplier=integer(irf.bearMultiplier,'River explicit bear multiplier');assert(multiplier>0,'AG integrity: SG River multiplier');}
 }
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','River reel results');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG River spin count');const spin=spins[0],wins=list(spin.WinInfo);
 ownPaidKeys(spin,'spinIndex|reelsetIndex|freeSpin|bonusAwarded|winCount|ReelStops'+(wins.length?'|WinInfo':''),'River spin');assert(spin.spinIndex==='0'&&spin.freeSpin===(first?'N':'Y')&&spin.bonusAwarded==='N','AG integrity: SG River spin markers');assert(integer(spin.reelsetIndex,'River reel set')<3,'AG integrity: SG River bootstrap reel set');vector(spin.ReelStops,8,'River eight reel stops');
 // The client consumes returned WinInfo entries. Own natural XML has index
 // gaps and winCount larger than the list. Require bounded, distinct keys
 // and exact cash conservation; do not invent omitted entries or their cash.
 const declared=integer(spin.winCount,'River win display count');assert(wins.length<=declared,'AG integrity: SG River award count');let cash=0;const seen=new Set<string>();
 for(const w of wins){ownPaidKeys(w,'direction|index|awardIndex|symbolId|ways|winValue|#text','River win');assert(['0','1'].includes(w.direction)&&integer(w.index,'River win index')<declared&&integer(w.ways,'River ways')>0,'AG integrity: SG River win index or ways');const key=w.direction+':'+w.index;assert(!seen.has(key),'AG integrity: SG River duplicate win');seen.add(key);integer(w.awardIndex,'River award');integer(w.symbolId,'River symbol');vector(w['#text'],undefined,'River typed winning positions');cash+=integer(w.winValue,'River actual raw win');}
 cash*=multiplier;assert(Number.isSafeInteger(cash)&&cash===integer(g.totalWin,'River current win'),'AG integrity: SG River cash components');const win=integer(g.BGInfo.totalWagerWin,'River cumulative'),bg=integer(g.BGInfo.bgWinnings,'River paid win');assert(win===(first?cash:previousWin+cash),'AG integrity: SG River cumulative cash');
 if(first)assert(bg===cash,'AG integrity: SG River paid components');else assert(bg===integer(base.BGInfo.bgWinnings,'River original paid win'),'AG integrity: SG River base cash changed');
 if(g.FSInfo){const f=g.FSInfo;if(first)ownPaidKeys(f,'fsWinnings|freeSpinsTotal|freeSpinNumber','River free introduction');const total=integer(f.freeSpinsTotal,'River total free'),played=integer(f.freeSpinNumber,'River played free'),freeWin=integer(f.fsWinnings,'River cumulative free win');assert(total>0&&played<=total&&bg+freeWin===win,'AG integrity: SG River free cash');
  if(first)assert(played===0&&freeWin===0,'AG integrity: SG River free intro');else assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+integer(f.extraSpinsAwarded,'River actual free award'),'AG integrity: SG River free transition');
  free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:win/100,...(expansions?{ownRiverExpansions:expansions}:{})};
 }else assert(first,'AG integrity: SG River free state disappeared');
 return {win,base,free};
}


export function validateZeusThree(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,previousWin:number) {
 assert(game.gameId==='32816'&&game.dbName==='sg_zeus3_prt'&&game.sg.runtimeGameId===33176&&game.sg.header.gameID==='20123'&&game.sg.header.gameCodeRGI==='zeus3_prt'&&game.sg.betRaw===40&&game.sg.zeusThreeContract==='zeus-three-own-line-free-wild-v1','AG integrity: SG own Zeus III binding');
 const feature=g?.Feature!==undefined;
 ownPaidKeys(g,'stake|stakePerLine|paylineCount|totalWin|betID|ReelResults|ReelSpinTimes|GameWinInfo'+(feature?'|Feature':'')+(g.WildInfo!==undefined?'|WildInfo':'')+(first?'':'|BaseGameRecoveryInfo'),'Zeus III result');
 assert(g.stake==='40'&&g.stakePerLine==='1'&&g.paylineCount==='192'&&typeof g.betID==='string','AG integrity: SG Zeus III wager');
 ownPositionNumbers(g.ReelSpinTimes,6,'Zeus III reel timing');
 ownPaidKeys(g.ReelResults,'numSpins|ReelSpin','Zeus III reels');const spins=list(g.ReelResults.ReelSpin);assert(g.ReelResults.numSpins==='1'&&spins.length===1,'AG integrity: SG Zeus III spin count');const r=spins[0];
 const lines=list(r.PaylineWin),scatters=list(r.ScatterWin);
 ownPaidKeys(r,'spinIndex|reelsetIndex|winCountPL|winCountSC|spinWins|freeSpin|bonusAwarded|ReelStops'+(lines.length?'|PaylineWin':'')+(scatters.length?'|ScatterWin':''),'Zeus III spin');
 assert(r.spinIndex==='0'&&r.reelsetIndex===(first?'0':'1')&&r.freeSpin===(first?'N':'Y'),'AG integrity: SG Zeus III reel mode');
 ownPositionNumbers(r.ReelStops,6,'Zeus III six reel stops');
 assert(integer(r.winCountPL,'Zeus III line count')===lines.length&&integer(r.winCountSC,'Zeus III scatter count')===scatters.length,'AG integrity: SG Zeus III win counts');
 let cash=0,scatterCash=0;const ids=new Set<number>();
 const positions=(s:any,label:string)=>{const p=ownPositionNumbers(s,undefined,label);assert(p.every(v=>v<42)&&new Set(p).size===p.length,'AG integrity: SG Zeus III original payline geometry');};
 for(const w of lines){ownPaidKeys(w,'index|winVal|awardIndex|awardTableIndex|#text','Zeus III line');const id=integer(w.index,'Zeus III line index');assert(id<192&&!ids.has(id),'AG integrity: SG Zeus III duplicate line');ids.add(id);integer(w.awardIndex,'Zeus III award');integer(w.awardTableIndex,'Zeus III award table');positions(w['#text'],'Zeus III line positions');cash+=integer(w.winVal,'Zeus III line cash');}
 for(const w of scatters){ownPaidKeys(w,'winVal|awardIndex|#text','Zeus III scatter');integer(w.awardIndex,'Zeus III scatter award');positions(w['#text'],'Zeus III scatter positions');scatterCash+=integer(w.winVal,'Zeus III scatter cash');}
 cash+=scatterCash;const reelCash=cash,spinCash=integer(r.spinWins,'Zeus III spin cash'),triggerField=first?'freeSpinTriggerWin':'freeSpinReTriggerWin',triggerCash=feature?integer(g.Feature.data[triggerField],'Zeus III explicitly returned trigger cash'):0,triggerCount=feature?integer(g.Feature.data[first?'totalFreeSpinsTriggered':'freeSpinsReTriggered'],'Zeus III explicit trigger count'):0;const separateTriggerCash=game.sg.zeusThreeTriggerCashContract==='own-exact-separate-trigger-cash-v3'&&feature&&triggerCash>0&&triggerCount>0&&scatterCash===0&&r.bonusAwarded==='Y'&&spinCash===reelCash&&integer(g.totalWin,'Zeus III current cash')===reelCash+triggerCash;if(separateTriggerCash)cash+=triggerCash;assert(Number.isSafeInteger(cash)&&spinCash===reelCash&&cash===integer(g.totalWin,'Zeus III current cash'),'AG integrity: SG Zeus III cash components');
 if(g.WildInfo!==undefined){assert(typeof g.WildInfo==='string'&&g.WildInfo.length>0,'AG integrity: SG Zeus III wild display');const seen=new Set<number>();for(const item of g.WildInfo.split(',')){const values=item.split('|');assert(values.length===3&&values.every((v:string)=>/^-?(?:0|[1-9]\d*)$/.test(v)),'AG integrity: SG Zeus III typed wild display');const [reel,offset,animate]=values.map(Number);assert([reel,offset,animate].every(Number.isSafeInteger)&&reel>=0&&reel<6&&!seen.has(reel)&&[0,1].includes(animate),'AG integrity: SG Zeus III wild reel identity');seen.add(reel);/* The own client consumes signed nudgingOffset; display never adds cash. */}}
 ownPaidKeys(g.GameWinInfo,'totalWagerWin|totalBGWin|totalFSWin|maxWinValue|isMaxWin','Zeus III winnings');const w=g.GameWinInfo,win=integer(w.totalWagerWin,'Zeus III cumulative'),bg=integer(w.totalBGWin,'Zeus III base cash'),fs=integer(w.totalFSWin,'Zeus III free cash');
 assert(w.isMaxWin==='N'&&w.maxWinValue==='25000000'&&bg+fs===win&&win===(first?cash:previousWin+cash),'AG integrity: SG Zeus III cumulative components');
 let free;
 if(first){assert(prior===undefined&&bg===cash&&fs===0,'AG integrity: SG Zeus III initial winnings');base=structuredClone(g);
  if(feature){ownPaidKeys(g.Feature,'index|name|data','Zeus III introduction');assert(g.Feature.index==='1'&&g.Feature.name==='FreeSpins','AG integrity: SG Zeus III feature identity');const f=g.Feature.data;ownPaidKeys(f,'freeSpinTriggerWin|totalFreeSpinsTriggered','Zeus III intro counters');const total=integer(f.totalFreeSpinsTriggered,'Zeus III triggered total');assert(total>0&&integer(f.freeSpinTriggerWin,'Zeus III trigger cash')===(separateTriggerCash?triggerCash:scatterCash),'AG integrity: SG Zeus III trigger components');free={freeSpinsTotal:total,freeSpinsPlayed:0,freeSpinsRemaining:total,accumulativeWin:win/100};}
  assert(r.bonusAwarded===(feature?'Y':'N'),'AG integrity: SG Zeus III paid feature marker');
 }else{
  assert(prior&&prior.freeSpinsRemaining>0&&base&&feature&&bg===integer(base.GameWinInfo.totalBGWin,'Zeus III original paid cash'),'AG integrity: SG Zeus III free state');
  const hasPaidWild=base.WildInfo!==undefined;ownPaidKeys(g.BaseGameRecoveryInfo,'ReelResults|Feature'+(hasPaidWild&&game.sg.zeusThreePaidRecoveryContract==='own-exact-paid-wild-display-v2'?'|WildInfo':''),'Zeus III paid recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults)&&JSON.stringify(g.BaseGameRecoveryInfo.Feature)===JSON.stringify(base.Feature),'AG integrity: SG Zeus III original paid recovery');if(hasPaidWild){assert(game.sg.zeusThreePaidRecoveryContract==='own-exact-paid-wild-display-v2'&&g.BaseGameRecoveryInfo.WildInfo===base.WildInfo,'AG integrity: SG Zeus III original paid WildInfo bytes');}
  ownPaidKeys(g.Feature,'index|name|data','Zeus III free feature');assert(g.Feature.index==='1'&&g.Feature.name==='FreeSpins','AG integrity: SG Zeus III free identity');const f=g.Feature.data;
  ownPaidKeys(f,'totalFreeSpinsWin|totalFreeSpinsAwarded|freeSpinsReTriggered|freeSpinReTriggerWin|remainingFreeSpins|lastFreeSpin','Zeus III free counters');
  const total=integer(f.totalFreeSpinsAwarded,'Zeus III total free'),extra=integer(f.freeSpinsReTriggered,'Zeus III returned extra'),remaining=integer(f.remainingFreeSpins,'Zeus III remaining free'),played=prior.freeSpinsPlayed+1;
  assert(total===prior.freeSpinsTotal+extra&&remaining===prior.freeSpinsRemaining-1+extra&&remaining===total-played&&integer(f.totalFreeSpinsWin,'Zeus III returned free cash')===fs,'AG integrity: SG Zeus III free transition');
  assert(integer(f.freeSpinReTriggerWin,'Zeus III returned retrigger cash')===(separateTriggerCash?triggerCash:scatterCash)&&r.bonusAwarded===(extra>0?'Y':'N')&&f.lastFreeSpin===(remaining===0?'Y':'N'),'AG integrity: SG Zeus III real terminal or award marker');
  free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100};
 }
 return {win,free,base};
}


function ownQuickHitPaidBinding(game:AGGameConfig) {
 const c=game.sg.ownQuickHitPaidContract,b:any={'32797':['sg_quickhitsuperwheelwildred',33157,'20291','quickhitsuperwheelwildred'],'32798':['sg_quickhitsundragon',33158,'20292','quickhitsundragon']},q=b[game.gameId];
 assert(q&&(c?.version==='own-quick-hit-paid-scatter-components-v2'||game.gameId==='32797'&&c?.version==='own-quick-hit-paid-scatter-wheel-v3'||c?.version==='own-quick-hit-client-features-v4'||game.gameId==='32798'&&['own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7'].includes(c?.version)||game.gameId==='32797'&&['own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c?.version))&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===game.sg.runtimeGameId&&game.dbName===q[0]&&game.sg.runtimeGameId===q[1]&&c.sourceGameId===q[2]&&game.sg.header.gameID===q[2]&&c.slug===q[3]&&game.sg.runtimeSlug===q[3]&&game.sg.header.gameCodeRGI===q[3]&&c.betRaw===200&&game.sg.betRaw===200&&c.ordinaryOnly===!['own-quick-hit-client-features-v4','own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7','own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version)&&c.unmappedFeatureRemainsFatal===true,'AG integrity: SG Quick Hit own binding');
 assert(c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&/^[0-9a-f]{64}$/.test(c.ownSourceCacheSHA256),'AG integrity: SG Quick Hit own evidence');return c;
}
export function validateOwnQuickHitPaid(game:AGGameConfig,g:any,first:boolean):number {
 const c=ownQuickHitPaidBinding(game);assert(first,'AG integrity: SG Quick Hit unmapped continuation');
 function check(v:any,path:string):void{if(Array.isArray(v)){assert(v.length>0,'AG integrity: SG Quick Hit empty structure');for(const q of v)check(q,path);return;}if(v&&typeof v==='object'){const s=c.schemas[path];assert(s&&Object.keys(v).every(k=>s.keys.includes(k))&&s.required.every((k:string)=>k in v),'AG integrity: SG Quick Hit own schema');for(const[k,q]of Object.entries(v))check(q,path+'/'+k);}}
 let wheelCash=0;
 if(g.WheelInfo!==undefined){assert(game.gameId==='32797'&&['own-quick-hit-paid-scatter-wheel-v3','own-quick-hit-client-features-v4','own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version)&&/^[a-f0-9]{64}$/.test(c.ownPaidWheelCompleteCacheSHA256),'AG integrity: SG own paid wheel binding');const w=g.WheelInfo;
  if(c.version==='own-quick-hit-client-paid-cash-wheel-v8'&&w.featureName==='QUICKHITS'){
   assert(c.ownClientAppSHA256==='c9975a3e20c940c6dde0af82430b2493b94d31273f1663beae0d75e4e086ed78'&&/^[a-f0-9]{64}$/.test(c.ownPaidQuickHitWheelClientProofSHA256),'AG integrity: SG own QUICKHITS client binding');
   ownPaidKeys(w,'featureName|outerWheelIndex|outerWheelType|innerWheelIndex|quickHitMultiplier|wheelPayout','own QUICKHITS paid wheel');assert(integer(w.outerWheelType,'own QUICKHITS type')===3,'AG integrity: SG own QUICKHITS wheel type');integer(w.outerWheelIndex,'own QUICKHITS outer index');integer(w.innerWheelIndex,'own QUICKHITS inner index');const mult=integer(w.quickHitMultiplier,'own QUICKHITS multiplier');wheelCash=integer(w.wheelPayout,'own QUICKHITS payout');assert(mult>0&&Number.isSafeInteger(mult*c.betRaw)&&wheelCash===mult*c.betRaw,'AG integrity: SG own QUICKHITS cash component');
  }else{ownPaidKeys(w,'featureName|outerWheelIndex|outerWheelType|innerWheelIndex|multiplier','own paid wheel');assert(w.featureName==='X_PAYS'&&integer(w.outerWheelType,'own wheel type')===4&&integer(w.multiplier,'own wheel metadata multiplier')>0,'AG integrity: SG unmapped wheel feature');integer(w.outerWheelIndex,'own outer wheel index');integer(w.innerWheelIndex,'own inner wheel index');}}

 const envelope={...g};delete envelope.WheelInfo;
 check(envelope,'GameResult');assert(!g.FSInfo&&!g.Feature&&!g.PickerInfo&&!g.BaseGameRecoveryInfo,'AG integrity: SG Quick Hit unmapped feature');
 assert(integer(g.stake,'Quick Hit stake')===200&&typeof g.betID==='string','AG integrity: SG Quick Hit wager');
 const cash=ownQuickHitReturnedCash(game,g,false)+wheelCash;
 assert(Number.isSafeInteger(cash)&&cash===integer(g.totalWin,'Quick Hit total cash')&&cash===integer(g.BGInfo.bgWinnings,'Quick Hit base cash')&&cash===integer(g.BGInfo.totalWagerWin,'Quick Hit cumulative cash')&&g.BGInfo.isMaxWin==='0','AG integrity: SG Quick Hit cash components');if(g.BGInfo.baseGameSpinsRemaining!==undefined)assert(integer(g.BGInfo.baseGameSpinsRemaining,'Quick Hit remaining')===0,'AG integrity: SG Quick Hit unmapped base spins');return cash;
}

function ownQuickHitReturnedCash(game:AGGameConfig,g:any,free:boolean):number {
 const paidLines=game.gameId==='32797',spins=list(g.ReelResults.ReelSpin);assert(spins.length===1&&integer(g.ReelResults.numSpins,'Quick Hit spin count')===1,'AG integrity: SG Quick Hit own spin');let cash=0;
 if(paidLines)assert(g.stakePerLine==='5'&&g.paylineCount==='30','AG integrity: SG Quick Hit own paylines');
 for(const s of spins){assert((free?['N','Y'].includes(s.freeSpin):s.freeSpin==='N')&&['N','Y'].includes(s.bonusAwarded)&&integer(s.spinIndex,'Quick Hit spin index')===0,'AG integrity: SG Quick Hit unmapped feature state');integer(s.reelsetIndex,'Quick Hit reel set');ownPositionNumbers(s.ReelStops,5,'Quick Hit reel stops');const wins=list(paidLines?s.PaylineWin:s.AnywayWin),scatters=list(s.ScatterWin);assert(wins.length===integer(paidLines?s.winCountPL:s.anywayWins,'Quick Hit award count')&&scatters.length===integer(paidLines?s.winCountSC:s.scatterWinCount,'Quick Hit scatter count'),'AG integrity: SG Quick Hit cash count');assert((free||((s.bonusAwarded==='Y')===(scatters.length>0))),'AG integrity: SG Quick Hit returned cash-scatter marker');let lines=0;const seen=new Set<number>();
  for(const [i,w]of wins.entries()){if(paidLines){const line=integer(w.index,'Quick Hit line index');assert(line<30&&!seen.has(line),'AG integrity: SG Quick Hit line identity');seen.add(line);integer(w.awardTableIndex,'Quick Hit award table');assert(ownPositionNumbers(w['#text'],undefined,'Quick Hit line positions').every(n=>n<15),'AG integrity: SG Quick Hit own bootstrap paylines');}else{assert(integer(w.winIndex,'Quick Hit win index')===i&&integer(w.ways,'Quick Hit ways')>0,'AG integrity: SG Quick Hit ways identity');ownPositionNumbers(w['#text'],undefined,'Quick Hit win positions');}integer(w.awardIndex,'Quick Hit award');lines+=integer(w.winVal,'Quick Hit line cash');}
  let scatter=0;for(const w of scatters){integer(w.awardIndex,'Quick Hit scatter award');if(w['#text']!==undefined)ownPositionNumbers(w['#text'],undefined,'Quick Hit scatter positions');scatter+=integer(w.winVal,'Quick Hit scatter cash');}
  assert((paidLines?lines+scatter:lines)===integer(paidLines?s.spinWins:s.totalSpinWin,'Quick Hit spin line cash'),'AG integrity: SG Quick Hit returned reel cash');cash+=lines+scatter;
 }
 assert(Number.isSafeInteger(cash),'AG integrity: SG Quick Hit unsafe cash');return cash;
}

export function validateOwnQuickHitFeatures(game:AGGameConfig,g:any,first:boolean,prior:any,base:any,priorWin:number):{win:number;free?:any;base?:any} {
 const c=ownQuickHitPaidBinding(game),hasWG=g?.WGInfo!==undefined,hasFS=g?.FSInfo!==undefined;
 if(!hasWG&&!hasFS){assert(first,'AG integrity: SG Quick Hit missing own continuation state');return {win:validateOwnQuickHitPaid(game,g,true)};}
 const hashes:any={'32797':'c9975a3e20c940c6dde0af82430b2493b94d31273f1663beae0d75e4e086ed78','32798':'dba5a17db6a922fa2c4b495ef8f8a72ae2aca2df3c036bf45bf3bce7c9738d84'};
 assert((c.version==='own-quick-hit-client-features-v4'||game.gameId==='32798'&&['own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7'].includes(c.version)||game.gameId==='32797'&&['own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version))&&c.ownClientAppSHA256===hashes[game.gameId]&&/^[a-f0-9]{64}$/.test(c.ownClientSemanticProofSHA256)&&/^[a-f0-9]{64}$/.test(c.ownObservedFreeIntroductionsSHA256),'AG integrity: SG Quick Hit own client feature binding');
 assert(!(hasWG&&hasFS)&&(!hasWG||game.gameId==='32797'),'AG integrity: SG Quick Hit unclassified simultaneous free stages');
 const f=hasWG?g.WGInfo:g.FSInfo,kind=hasWG?'WG':'FS';
 const allowed=['fsWinnings','freeSpinsTotal','freeSpinNumber','isMaxWin','spinsUsed','spinsRemaining','extraSpinsAwarded',...(hasWG?['wildsAdded','totalWildsAdded']:game.gameId==='32798'?['patternGroup','patternIndex']:[])];
 assert(f&&typeof f==='object'&&!Array.isArray(f)&&Object.keys(f).every(k=>allowed.includes(k))&&['fsWinnings','freeSpinsTotal','freeSpinNumber','isMaxWin',...(hasWG?['wildsAdded','totalWildsAdded']:[])].every(k=>k in f),'AG integrity: SG Quick Hit free schema');
 const total=integer(f.freeSpinsTotal,'Quick Hit total'),played=integer(f.freeSpinNumber,'Quick Hit played'),remaining=total-played,freeCash=integer(f.fsWinnings,'Quick Hit cumulative free cash');
 assert(total>0&&played<=total&&f.isMaxWin==='0'&&g.BGInfo?.isMaxWin==='0','AG integrity: SG Quick Hit free counter/max');
 for(const k of ['patternIndex','patternGroup'])if(f[k]!==undefined)integer(f[k],'Quick Hit own pattern metadata');
 if(f.spinsUsed!==undefined)assert(integer(f.spinsUsed,'Quick Hit used')===played,'AG integrity: SG Quick Hit used counter');
 if(f.spinsRemaining!==undefined)assert(integer(f.spinsRemaining,'Quick Hit remaining')===remaining,'AG integrity: SG Quick Hit remaining counter');
 const extra=f.extraSpinsAwarded===undefined?0:integer(f.extraSpinsAwarded,'Quick Hit actual additional free award');
 let wheelAward=0;
 if(g.WheelInfo!==undefined){const w=g.WheelInfo;
  if(!first&&game.gameId==='32797'&&['own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version)&&w.featureName===undefined){
   assert(!hasWG&&hasFS&&/^[a-f0-9]{64}$/.test(c.ownFreeCashWheelClientProofSHA256),'AG integrity: SG Quick Hit own free wheel binding');
   ownPaidKeys(w,'wheelIndex|multiplier','Quick Hit own current free wheel');integer(w.wheelIndex,'Quick Hit own current wheel index');assert(integer(w.multiplier,'Quick Hit own current wheel multiplier')>0,'AG integrity: SG Quick Hit own current wheel multiplier');
   // Own client displays the returned multiplier. Returned PaylineWin already
   // contains the award; never multiply money or introduce a new free budget.
  }else{
   ownPaidKeys(w,'featureName|outerWheelIndex|outerWheelType|innerWheelIndex|freeSpinsAwarded','Quick Hit free wheel');
   assert(game.gameId==='32797'&&w.featureName===(hasWG?'WILDGAMES':'FREESPINS'),'AG integrity: SG Quick Hit wheel/free kind');
   for(const k of ['outerWheelIndex','outerWheelType','innerWheelIndex'])integer(w[k],'Quick Hit wheel index');wheelAward=integer(w.freeSpinsAwarded,'Quick Hit actual wheel award');assert(wheelAward>0,'AG integrity: SG Quick Hit missing wheel award');
  }}
 const envelope={...g};delete envelope.WGInfo;delete envelope.FSInfo;delete envelope.WheelInfo;delete envelope.BaseGameRecoveryInfo;
 if(g.FSShapeInfo!==undefined){assert(game.gameId==='32798'&&['own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7'].includes(c.version)&&hasFS&&!first&&/^[a-f0-9]{64}$/.test(c.ownFreeShapeClientProofSHA256),'AG integrity: SG Quick Hit own free shape binding');ownPaidKeys(g.FSShapeInfo,'positionsToSkip','Quick Hit own free shape');const skips=g.FSShapeInfo.positionsToSkip;const skip=c.version==='own-quick-hit-client-empty-shape-v7'&&skips===''?[]:ownPositionNumbers(skips,undefined,'Quick Hit own free skipped positions');assert(new Set(skip).size===skip.length,'AG integrity: SG Quick Hit duplicate skipped position');delete envelope.FSShapeInfo;}
 if(!first&&game.gameId==='32798'&&['own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7'].includes(c.version)&&g.BGInfo.isBigBet!==undefined){assert(g.BGInfo.isBigBet==='0','AG integrity: SG Quick Hit unexpected free big bet');envelope.BGInfo={...g.BGInfo};delete envelope.BGInfo.isBigBet;}
 if(game.gameId==='32798'&&c.version==='own-quick-hit-client-empty-shape-v7'){
  assert(/^[a-f0-9]{64}$/.test(c.ownEmptyShapeClientProofSHA256),'AG integrity: SG Quick Hit own empty shape binding');
  if(g.BGShapeInfo!==undefined){ownPaidKeys(g.BGShapeInfo,'positionsToSkip','Quick Hit own base shape');const skips=g.BGShapeInfo.positionsToSkip;const positions=skips===''?[]:ownPositionNumbers(skips,undefined,'Quick Hit own base skipped positions');assert(new Set(positions).size===positions.length,'AG integrity: SG Quick Hit duplicate base skipped position');}
 }
 let baseCash:number,win:number;
 if(first){assert(played===0&&freeCash===0&&extra===0&&remaining===total,'AG integrity: SG Quick Hit invalid free introduction');
  assert(!hasWG||wheelAward===total,'AG integrity: SG Quick Hit wheel introduced budget');
  assert(g.BaseGameRecoveryInfo===undefined,'AG integrity: SG Quick Hit unexpected paid recovery');
  win=validateOwnQuickHitPaid(game,envelope,true);baseCash=win;base=structuredClone(g);
  if(hasWG)assert(f.wildsAdded==='0'&&f.totalWildsAdded==='0','AG integrity: SG Quick Hit intro wild state');
 }else{
  assert(prior&&base&&prior.ownQuickHitFreeKind===kind,'AG integrity: SG Quick Hit changed free kind');
  function check(v:any,p:string):void{if(Array.isArray(v)){assert(v.length>0,'AG integrity: SG Quick Hit empty free structure');for(const q of v)check(q,p);return;}if(v&&typeof v==='object'){const s=c.schemas[p];assert(s&&Object.keys(v).every(k=>s.keys.includes(k))&&s.required.every((k:string)=>k in v),'AG integrity: SG Quick Hit own continuation schema');for(const [k,q]of Object.entries(v))check(q,p+'/'+k);}}
  check(envelope,'GameResult');assert(integer(g.stake,'Quick Hit free stake')===200&&typeof g.betID==='string','AG integrity: SG Quick Hit changed free wager');
  const awarded=wheelAward||extra;assert(!wheelAward||extra===0||wheelAward===extra,'AG integrity: SG Quick Hit inconsistent award components');
  assert(played===prior.freeSpinsPlayed+1&&total===prior.freeSpinsTotal+awarded&&remaining===prior.freeSpinsRemaining-1+awarded,'AG integrity: SG Quick Hit free budget transition');
  if(g.BaseGameRecoveryInfo!==undefined){ownPaidKeys(g.BaseGameRecoveryInfo,'ReelResults','Quick Hit base recovery');assert(JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(base.ReelResults),'AG integrity: SG Quick Hit original base recovery changed');}
  baseCash=integer(base.BGInfo.bgWinnings,'Quick Hit original base cash');const returnedCash=ownQuickHitReturnedCash(game,g,true);let cash=returnedCash;if(game.gameId==='32798'&&['own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7'].includes(c.version)){assert(/^[a-f0-9]{64}$/.test(c.ownFreeShapeClientProofSHA256),'AG integrity: SG Quick Hit own effective cash binding');cash=integer(g.totalWin,'Quick Hit own effective root cash');assert(cash>=returnedCash,'AG integrity: SG Quick Hit returned cash exceeds own effective root');}
  if(game.gameId==='32797'&&['own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version)){
   assert(/^[a-f0-9]{64}$/.test(c.ownFreeCashWheelClientProofSHA256),'AG integrity: SG Quick Hit own cumulative cash binding');
   // C1 assigns BG totalWagerWin to the cumulative cash display; KU assigns
   // fsWinnings to the free display. Reel awards retain their separate strict
   // component check. No refund, minimum or fixed wager amount is invented.
   cash=integer(g.totalWin,'Quick Hit own current free cash');assert(returnedCash<=cash,'AG integrity: SG Quick Hit reel awards exceed own current cash');
  }
  assert(cash===integer(g.totalWin,'Quick Hit current free cash')&&baseCash===integer(g.BGInfo.bgWinnings,'Quick Hit retained base cash')&&baseCash+freeCash===integer(g.BGInfo.totalWagerWin,'Quick Hit total free cash')&&baseCash+freeCash===priorWin+cash,'AG integrity: SG Quick Hit free money transition');
  win=baseCash+freeCash;
  if(hasWG)assert(integer(f.totalWildsAdded,'Quick Hit total wilds')===prior.ownQuickHitTotalWilds+integer(f.wildsAdded,'Quick Hit added wilds'),'AG integrity: SG Quick Hit wild counter transition');
 }
 assert(Number.isSafeInteger(win),'AG integrity: SG Quick Hit unsafe cumulative cash');
 return {win,base,free:{freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:remaining,accumulativeWin:win/100,ownQuickHitFreeKind:kind,...(hasWG?{ownQuickHitTotalWilds:integer(f.totalWildsAdded,'Quick Hit wild count')}:{})}};
}

// Own32750 private SG source authority; no public frame/paid-root issuer.
const own32750Slots = new WeakMap<object, any>();
const own32750Started = new WeakSet<object>();
function own32750Slot(session: object) {
    const slot=own32750Slots.get(session);
    assert(slot && slot.game.gameId==='32750','AG integrity: own32750 private SG slot');
    return slot;
}
function own32750Integrity(error: unknown): Error {
    if((error as any)?.own32750DeterministicIntegrityStop===true)return error as Error;
    return Object.assign(new Error('AG integrity: own32750 native DATA stopped; original outcome retained'),
        {cause:error,own32750DeterministicIntegrityStop:true,retryAllowed:false});
}
function own32750Stop(session: object,error: unknown,close:()=>void): never {
    const failure=own32750Integrity(error),slot=own32750Slots.get(session),cleanup: unknown[]=[];
    if(slot){slot.error=failure;try{slot.ownerHooks?.seal(error);}catch(e){cleanup.push(e);}}
    try{close();}catch(e){cleanup.push(e);}
    if(cleanup.length)(failure as any).cleanupErrors=cleanup;
    throw failure;
}

// Own32806 original wire authority remains module-private. Only the registered own DATA live entry may enable source.
const own32806WireSlots=new WeakMap<object,any>();
function own32806WireSlot(session:object){const slot=own32806WireSlots.get(session);assert(slot,'AG integrity: own32806 original private slot missing');return slot;}
function own32806WireStop(session:any,error:unknown):never{
 const slot=own32806WireSlots.get(session),failure=Object.assign(new Error('AG integrity: own32806 original native wire held'),{cause:error,own32806DeterministicIntegrityStop:true,retryAllowed:false});
 if(slot){slot.error=failure;try{slot.binding?.originalOwnerHooks.seal(error);}catch{}try{slot.wire.ownerHooks.seal(error);}catch{}}
 session.close();throw failure;
}

// Own32816 original wire authority. This remains module-private and source-disabled.
const own32816WireSlots=new WeakMap<object,any>();
function own32816WireSlot(session:object){const slot=own32816WireSlots.get(session);assert(slot,'AG integrity: own32816 original private slot missing');return slot;}
function own32816WireStop(session:any,error:unknown):never{
 const slot=own32816WireSlots.get(session),failure=Object.assign(new Error('AG integrity: own32816 original native wire held'),{cause:error,own32816DeterministicIntegrityStop:true,retryAllowed:false});
 if(slot){slot.error=failure;try{slot.binding?.originalOwnerHooks.seal(error);}catch{}try{slot.wire.ownerHooks.seal(error);}catch{}}
 session.close();throw failure;
}

const own32763ProtocolSlots=new WeakMap<object,any>();
function own32763Hold(error:unknown):Error{return Object.assign(new Error('AG integrity: own32763 original protocol outcome retained'),{cause:error,own32763DeterministicIntegrityStop:true,retryAllowed:false});}
const own32761ProtocolSlots=new WeakMap<object,any>();
const own32760ProtocolSlots=new WeakMap<object,any>();
function own32761Hold(error:unknown):Error{return Object.assign(new Error('AG integrity: own32761 original protocol outcome retained'),{cause:error,own32761DeterministicIntegrityStop:true,retryAllowed:false});}
function own32760Hold(error:unknown):Error{return Object.assign(new Error('AG integrity: own32760 original protocol outcome retained'),{cause:error,own32760DeterministicIntegrityStop:true,retryAllowed:false});}
const own32756ProtocolSlots=new WeakMap<object,any>();
function own32756Hold(error:unknown):Error{return Object.assign(new Error('AG integrity: own32756 original protocol outcome retained'),{cause:error,own32756DeterministicIntegrityStop:true,retryAllowed:false});}
export class SGWmsSession {
    private balance = Number.NaN;
    private startBalance = Number.NaN;
    private totalWin = 0;
    private free: Record<string, any> | undefined;
    private action = 'SPIN';
    private goldenPending: {count:number;stop:string;baseWin:number} | undefined;
    private steps: WireStep[] = [];
    private readonly freshFreeId = 'Free:' + crypto.randomBytes(16).toString('hex');
    private session = this.freshFreeId;
    private closed = false;
    private lastRequest: {event:string;parameters:Record<string,any>|null} | undefined;
    private lastBase: unknown;
    private eightyBase: unknown;
    private coolJewelsBase:any;
    private fudaBase: unknown;
    private healthyComponentsBase:any;
    private riverBase:any;
    private zeusThreeBase:any;
    private journal: number | null = null;
    private journalPath: string | null = null;
    private ordinal = 0;
    private cookies = new Map<string,string>();
    private gameplayRequestHasBeenSent = false;
    constructor(private readonly game: AGGameConfig, private readonly transport?: WireTransport, initialBalance?: number) {
        assert(game.provider === 'sg' && game.sg?.protocol === 'wms', 'AG integrity: SG protocol adapter unavailable');
        assert(game.sg.endpoint === 'https://gls.atc.casinarena.com/gls.rgsx', 'AG integrity: SG endpoint');
        assert(String(game.sg.header?.gameCodeRGI).length > 0 && /^\d+$/.test(String(game.sg.header?.gameID)), 'AG integrity: SG game binding');
        assert(Number.isSafeInteger(game.sg.betRaw) && game.sg.betRaw > 0, 'AG integrity: SG wager binding');
        if(initialBalance !== undefined) { assert(Number.isSafeInteger(initialBalance)); this.balance=initialBalance; }
    }
    private evidence(value: Record<string,unknown>) {
        if(this.transport) return; // offline transport keeps its own supplied evidence
        if(this.journal === null) {
            const dir=path.resolve(process.env.SG_EVIDENCE_DIR || '.sg-evidence');fs.mkdirSync(dir,{recursive:true});
            if(this.journalPath===null) {
                this.journalPath=path.join(dir,`${this.game.gameId}-${process.pid}-${crypto.randomUUID()}.jsonl`);
                this.journal=fs.openSync(this.journalPath,'wx',0o600);
            } else {
                // A response already in flight can finish after AG closes this session.
                // Keep it beside its original intent; closing never authorizes another request.
                this.journal=fs.openSync(this.journalPath,'a',0o600);
            }
        }
        fs.writeSync(this.journal, JSON.stringify({...value,at:new Date().toISOString()})+'\n');fs.fsyncSync(this.journal);
        if(this.closed) {fs.closeSync(this.journal);this.journal=null;}
    }
    private async connectOwn32761Protocol(): Promise<void> {
        assert(!this.closed&&!own32761ProtocolSlots.has(this)&&!Number.isFinite(this.balance),'AG integrity: own32761 one original Init; no injected balance');
        if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
        const slot:any={};own32761ProtocolSlots.set(this,slot);
        try {
            const register=require('./own32761-protocol-data/register.cjs');
            slot.connection=register.createOwn32761OriginalSGConnection({sessionScope:this,game:this.game,
                readOriginalState:()=>({sessionScope:this,game:this.game,closed:this.closed,action:this.action,sessionID:this.session,balanceRaw:this.balance})});
            const step=await this.exchange('Init',{});this.readEnvelope(step,'Init');
        }catch(error){slot.connection?.seal(error);this.close();throw own32761Hold(error);}
    }
private async connectOwn32760Protocol(): Promise<void> {
        assert(!this.closed&&!own32760ProtocolSlots.has(this)&&!Number.isFinite(this.balance),'AG integrity: own32760 one original Init; no injected balance');
        if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
        const slot:any={};own32760ProtocolSlots.set(this,slot);
        try {
            const register=require('./own32760-protocol-data/register.cjs');
            slot.connection=register.createOwn32760OriginalSGConnection({sessionScope:this,game:this.game,
                readOriginalState:()=>({sessionScope:this,game:this.game,closed:this.closed,action:this.action,sessionID:this.session,balanceRaw:this.balance})});
            const step=await this.exchange('Init',{});this.readEnvelope(step,'Init');
        }catch(error){slot.connection?.seal(error);this.close();throw own32760Hold(error);}
    }
    private async connectOwn32756Protocol(): Promise<void> {
        assert(!this.closed&&!own32756ProtocolSlots.has(this)&&!Number.isFinite(this.balance),'AG integrity: own32756 one original Init; no injected balance');
        if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
        const slot:any={};own32756ProtocolSlots.set(this,slot);
        try {
            const register=require('./own32756-protocol-data/register.cjs');
            slot.connection=register.createOwn32756OriginalSGConnection({sessionScope:this,game:this.game,
                readOriginalState:()=>({sessionScope:this,game:this.game,closed:this.closed,action:this.action,sessionID:this.session,balanceRaw:this.balance})});
            const step=await this.exchange('Init',{});this.readEnvelope(step,'Init');
        }catch(error){slot.connection?.seal(error);this.close();throw own32756Hold(error);}
    }
    private async connectOwn32763Protocol(): Promise<void> {
        assert(!this.closed&&!own32763ProtocolSlots.has(this)&&!Number.isFinite(this.balance),'AG integrity: own32763 one original Init; no injected balance');
        if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
        const slot:any={};own32763ProtocolSlots.set(this,slot);
        try {
            const register=require('./own32763-protocol-data/register.cjs');
            slot.connection=register.createOwn32763OriginalSGConnection({sessionScope:this,game:this.game,
                readOriginalState:()=>({sessionScope:this,game:this.game,closed:this.closed,action:this.action,sessionID:this.session,balanceRaw:this.balance})});
            const step=await this.exchange('Init',{});this.readEnvelope(step,'Init');
        }catch(error){slot.connection?.seal(error);this.close();throw own32763Hold(error);}
    }
    private async connectOwn32750Native(): Promise<void> {
        try {
            assert(!this.closed&&!this.transport&&!own32750Started.has(this),
                'AG integrity: own32750 one original live native Init lifecycle');
            assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
            own32750Started.add(this);
            const slot:any={game:this.game};own32750Slots.set(this,slot);
            const registration=require('./own32750-native-data/register.cjs');
            registration.validateOwn32750Runtime(this.game);
            const currentHeaderValue=(key:string)=>{const value=this.game.sg.header[key];assert(typeof value==='string'&&value.length>0,'AG integrity: own32750 actual current '+key);return value;};
            const sessionData=Object.freeze({getSessionID:()=>this.session,
                getContextID:()=>currentHeaderValue('affiliate'),getPlayerID:()=>currentHeaderValue('userID')});
            const bundle=registration.createOwn32750SessionBundle({sessionScope:this,game:this.game,sessionData,
                readRawEnvelope:(text:string)=>xml.parse(text)?.GameResponse,
                localIOTimeoutMs:sgRequestTimeoutMs(this.game),
                assertOriginalSessionOpen:(context:any)=>{
                    assert(!this.closed&&own32750Slots.get(this)===slot&&!slot.error&&context.sessionScope===this&&context.game===this.game,
                        'AG integrity: own32750 original session scope');
                }});
            Object.assign(slot,bundle);
            const dispatch=await slot.connection.prepareInit();
            const step=await this.exchange('Init',{},undefined,undefined,dispatch);
            const envelope=this.readEnvelope(step,'Init');
            const frame=slot.ownerHooks.commitOriginalSuccess(step,envelope,this.balance);
            await slot.connection.bootstrap(frame);
        } catch(error) {own32750Stop(this,error,()=>this.close());}
    }
    private async callOwn32750NativeData(event:string,parameters:Record<string,any>|null) {
        try {
            assert(!this.closed,'AG integrity: own32750 original session closed');
            const slot=own32750Slot(this),dispatch=await slot.connection.take(event,parameters,this.session);
            const step=await this.exchange(event,{},undefined,undefined,dispatch);
            const envelope=this.readEnvelope(step,event);
            const frame=slot.ownerHooks.commitOriginalSuccess(step,envelope,this.balance);
            const result=await slot.connection.finish(frame,step,this.balance);
            this.action=result.NextActionInfo.nextAction;
            return result;
        } catch(error) {own32750Stop(this,error,()=>this.close());}
    }
    private bindOwn32806OriginalWire(createNativeBinding:any) {
        assert((((this.game.sg as any).own32806OriginalWire?.contract==='own32806-original-wire-preparation-v694'&&process.env.SG_OWN32806_PRIVATE_NATIVE_PREPARATION==='1'&&process.env.SG_AG_ALLOW_SOURCE!=='1')||((this.game.sg as any).own32806OriginalWire?.contract==='own32806-original-wire-native-v1'&&process.env.SG_AG_ALLOW_SOURCE==='1'))&&!this.closed&&!this.transport&&!own32806WireSlots.has(this)&&typeof createNativeBinding==='function','AG integrity: own32806 private source binding');
        const slot:any={game:this.game,consumed:new WeakSet(),acceptedEnvelopes:new WeakMap(),currentDispatch:null,originalReturnedResults:new WeakMap()};own32806WireSlots.set(this,slot);
        try {
            slot.wire=require('./own32806-native-data/original-accepted-wire-owner.cjs').createOwn32806OriginalAcceptedWireOwner({sessionScope:this,game:this.game,
                assertOriginalSessionOpen:(c:any)=>assert(!this.closed&&!slot.error&&own32806WireSlots.get(this)===slot&&c.sessionScope===this&&c.game===this.game,'AG integrity: own32806 original source closed'),
                assertCurrentConsumedNativeDispatch:(d:any)=>assert(slot.currentDispatch===d&&slot.consumed.has(d),'AG integrity: own32806 unconsumed/foreign native dispatch'),
                assertOriginalAcceptedStep:(s:any,e:any)=>assert(slot.acceptedEnvelopes.get(s)===e,'AG integrity: own32806 original parsed step capability'),readOriginalSessionID:()=>this.session});
            slot.binding=createNativeBinding({sessionScope:this,game:this.game,readOriginalSessionID:()=>this.session,
                assertOriginalSessionOpen:(c:any)=>assert(!this.closed&&!slot.error&&own32806WireSlots.get(this)===slot&&c.sessionScope===this&&c.game===this.game,'AG integrity: own32806 original source closed'),
                ...slot.wire.privateReaders});
            assert(typeof slot.binding?.providerData?.consumeCurrentNative==='function'&&typeof slot.binding?.originalOwnerHooks?.recordAndDeliverOriginalParsedResponse==='function','AG integrity: own32806 actual private native binding required');
        }catch(error){own32806WireStop(this,error);}
    }
    private async exchangeOwn32806OriginalNative(event:string,parameters:any) {
        try {
            const slot=own32806WireSlot(this);assert(!this.closed&&!slot.error,'AG integrity: own32806 source closed');
            const dispatch=slot.binding.providerData.consumeCurrentNative(event,parameters,this.session);slot.currentDispatch=dispatch;slot.consumed.add(dispatch);
            const step=await this.exchange(event,{},undefined,undefined,undefined,dispatch),envelope=this.readEnvelope(step,event);
            const delivery=await slot.binding.originalOwnerHooks.recordAndDeliverOriginalParsedResponse(dispatch,step);
            const result=Object.freeze({step,envelope,delivery,businessSuccessOrCompletionAssessed:false});
            const originalRaw=slot.wire.privateReaders.readAcceptedOriginalExchange(dispatch,step);
            slot.originalReturnedResults.set(result,originalRaw);
            return result;
        }catch(error){own32806WireStop(this,error);}
    }
    private async connectOwn32806Native(): Promise<void> {
        try {
            assert(!this.closed&&!this.transport&&!own32806WireSlots.has(this),
                'AG integrity: own32806 one original live Init lifecycle');
            assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: SG live source not enabled');
            const registration=require('./own32806-native-data/register.cjs');
            registration.validateOwn32806Runtime(this.game);
            const currentHeaderValue=(key:string)=>{const value=this.game.sg.header[key];assert(typeof value==='string'&&value.length>0,'AG integrity: own32806 actual current '+key);return value;};
            const sessionData=Object.freeze({getSessionID:()=>this.session,
                getContextID:()=>currentHeaderValue('affiliate'),getPlayerID:()=>currentHeaderValue('userID')});
            const bundle=registration.createOwn32806SessionBundle({sessionScope:this,game:this.game,sessionData,
                readRawEnvelope:(text:string)=>xml.parse(text)?.GameResponse,
                localIOTimeoutMs:sgRequestTimeoutMs(this.game),
                assertOriginalSessionOpen:(context:any)=>assert(!this.closed&&context.sessionScope===this&&context.game===this.game,
                    'AG integrity: own32806 original registered session scope')});
            assert(bundle?.sourceIsOfflineTest===false,'AG integrity: own32806 registered live DATA bundle required');
            await this.installOwn32806NativeLifecycle(bundle);
        } catch(error) {own32806WireStop(this,error);}
    }
    private async connectOwn32806NativePreparation(bundle:any): Promise<void> {
        assert(process.env.SG_OWN32806_PRIVATE_NATIVE_PREPARATION==='1'&&process.env.SG_AG_ALLOW_SOURCE!=='1'&&bundle?.sourceIsOfflineTest===true,
            'AG integrity: own32806 lifecycle remains offline-only; production admission required');
        await this.installOwn32806NativeLifecycle(bundle);
    }
    private async installOwn32806NativeLifecycle(bundle:any): Promise<void> {
        assert(!this.closed&&!this.transport&&!own32806WireSlots.has(this)&&typeof bundle.createBinding==='function'&&typeof bundle.createHost==='function',
            'AG integrity: own32806 one original private lifecycle');
        this.bindOwn32806OriginalWire((privateInputs:any)=>bundle.createBinding(privateInputs));
        const slot=own32806WireSlot(this),host=bundle.createHost();slot.host=host;
        assert(host&&typeof host.boot==='function'&&typeof bundle.yieldNative==='function','AG integrity: own32806 original host callbacks');
        const lifecycle=require('./own32806-native-data/own32806-original-SG-lifecycle-DATA-v855.cjs');
        const selectors=require('./own32806-native-data/own32806-original-Main-next-request-selector-v899.cjs');
        const money=require('./own32806-native-data/own32806-original-SG-money-projection-v853.cjs');
        const units=require('./own32806-native-data/own32806-original-SG-unit-v853.cjs');
        slot.lifecycle=lifecycle.createOwn32806OriginalSGLifecycle({sessionScope:this,game:this.game,binding:slot.binding,
            assertOriginalOpen:()=>assert(!this.closed&&!slot.error&&own32806WireSlots.get(this)===slot,'AG integrity: own32806 original session open'),
            readOriginalSessionID:()=>this.session,readOriginalCashRaw:()=>this.balance,readOriginalAction:()=>this.action,
            exchangeOriginalNative:(event:string,parameters:any)=>this.exchangeOwn32806OriginalNative(event,parameters),
            authenticateOriginalResult:(result:any,event:string)=>{
                const originalRaw=slot.originalReturnedResults.get(result);
                assert(originalRaw&&result.step===originalRaw.parsedStep&&result.step.msgId===event&&originalRaw.nativeDispatch===slot.currentDispatch,
                    'AG integrity: own32806 same private original result capability');
                assert(slot.wire.privateReaders.readAcceptedOriginalExchange(slot.currentDispatch,result.step)===originalRaw,
                    'AG integrity: own32806 original result no longer current');
                return originalRaw;
            },
            createSelector:(d:any)=>selectors.createOwn32806OriginalMainSelector({...d,selectOwnNativeMenu:(h:any)=>{assert(typeof bundle.selectOwnNativeMenu==='function');return bundle.selectOwnNativeMenu(h);}}),
            createProjection:(source:any)=>money.createOwn32806OriginalSGMoneyProjection({source,readOwnOriginalUnit:units.createOwn32806OriginalSGUnitReader(source)}),
            readHost:()=>host,wallNow:()=>Date.now(),yieldNative:()=>bundle.yieldNative(host),
            timeoutMs:bundle.timeoutMs,maxTicks:bundle.maxTicks});
        try{host.boot();await slot.lifecycle.bootstrap();}catch(error){own32806WireStop(this,error);}
    }
    private async callOwn32806NativePreparation(event:string,parameters:any) {
        try{
            const slot=own32806WireSlot(this);assert(slot.lifecycle,'AG integrity: own32806 lifecycle not connected');
            const result=await slot.lifecycle.call(event,parameters);this.action=result.NextActionInfo.nextAction;return result;
        }catch(error){own32806WireStop(this,error);}
    }
    private bindOwn32816OriginalWire(createNativeBinding:any) {
        assert((((this.game.sg as any).own32816OriginalWire?.contract==='own32816-original-wire-preparation-v694'&&process.env.SG_OWN32816_PRIVATE_NATIVE_PREPARATION==='1'&&process.env.SG_AG_ALLOW_SOURCE!=='1')||((this.game.sg as any).own32816OriginalWire?.contract==='own32816-original-wire-native-v1'&&process.env.SG_AG_ALLOW_SOURCE==='1'))&&!this.closed&&!this.transport&&!own32816WireSlots.has(this)&&typeof createNativeBinding==='function','AG integrity: own32816 private source binding');
        const slot:any={game:this.game,consumed:new WeakSet(),acceptedEnvelopes:new WeakMap(),currentDispatch:null,originalReturnedResults:new WeakMap()};own32816WireSlots.set(this,slot);
        try {
            slot.wire=require('./own32816-native-data/original-accepted-wire-owner.cjs').createOwn32816OriginalAcceptedWireOwner({sessionScope:this,game:this.game,
                assertOriginalSessionOpen:(c:any)=>assert(!this.closed&&!slot.error&&own32816WireSlots.get(this)===slot&&c.sessionScope===this&&c.game===this.game,'AG integrity: own32816 original source closed'),
                assertCurrentConsumedNativeDispatch:(d:any)=>assert(slot.currentDispatch===d&&slot.consumed.has(d),'AG integrity: own32816 unconsumed/foreign native dispatch'),
                assertOriginalAcceptedStep:(s:any,e:any)=>assert(slot.acceptedEnvelopes.get(s)===e,'AG integrity: own32816 original parsed step capability'),readOriginalSessionID:()=>this.session});
            slot.binding=createNativeBinding({sessionScope:this,game:this.game,readOriginalSessionID:()=>this.session,
                assertOriginalSessionOpen:(c:any)=>assert(!this.closed&&!slot.error&&own32816WireSlots.get(this)===slot&&c.sessionScope===this&&c.game===this.game,'AG integrity: own32816 original source closed'),
                ...slot.wire.privateReaders});
            assert(typeof slot.binding?.providerData?.consumeCurrentNative==='function'&&typeof slot.binding?.originalOwnerHooks?.recordAndDeliverOriginalParsedResponse==='function','AG integrity: own32816 actual private native binding required');
        }catch(error){own32816WireStop(this,error);}
    }
    private async exchangeOwn32816OriginalNative(event:string,parameters:any) {
        try {
            const slot=own32816WireSlot(this);assert(!this.closed&&!slot.error,'AG integrity: own32816 source closed');
            const dispatch=slot.binding.providerData.consumeCurrentNative(event,parameters,this.session);slot.currentDispatch=dispatch;slot.consumed.add(dispatch);
            const step=await this.exchange(event,{},undefined,undefined,undefined,undefined,dispatch),envelope=this.readEnvelope(step,event);
            const delivery=await slot.binding.originalOwnerHooks.recordAndDeliverOriginalParsedResponse(dispatch,step);
            const result=Object.freeze({step,envelope,delivery,businessSuccessOrCompletionAssessed:false});
            const originalRaw=slot.wire.privateReaders.readAcceptedOriginalExchange(dispatch,step);
            slot.originalReturnedResults.set(result,originalRaw);
            return result;
        }catch(error){own32816WireStop(this,error);}
    }
    private async connectOwn32816NativeLive(): Promise<void> {
        try{
            assert(!this.closed&&!this.transport&&!own32816WireSlots.has(this)&&process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: own32816 one original live Init lifecycle');
            const registration=require('./own32816-native-data/register.cjs');registration.validateOwn32816Runtime(this.game);
            const currentHeaderValue=(key:string)=>{const value=this.game.sg.header[key];assert(typeof value==='string'&&value.length>0,'AG integrity: own32816 actual current '+key);return value;};
            const sessionData=Object.freeze({getSessionID:()=>this.session,getContextID:()=>currentHeaderValue('affiliate'),getPlayerID:()=>currentHeaderValue('userID')});
            const bundle=registration.createOwn32816SessionBundle({sessionScope:this,game:this.game,sessionData,localIOTimeoutMs:sgRequestTimeoutMs(this.game),
                readRawEnvelope:(step:any,event:string)=>this.readEnvelope(step,event),assertOriginalSessionOpen:(c:any)=>assert(!this.closed&&!this.transport&&c.sessionScope===this&&c.game===this.game,'AG integrity: own32816 original factory/session scope')});
            assert(bundle?.sourceIsOfflineTest===false,'AG integrity: own32816 production factory only');
            return this.installOwn32816OriginalNativeLifecycle(bundle);
        }catch(error){own32816WireStop(this,error);}
    }
    private async connectOwn32816NativePreparation(bundle:any): Promise<void> {
        assert(process.env.SG_OWN32816_PRIVATE_NATIVE_PREPARATION==='1'&&process.env.SG_AG_ALLOW_SOURCE!=='1'&&bundle?.sourceIsOfflineTest===true,
            'AG integrity: own32816 lifecycle remains offline-only; production admission required');
        return this.installOwn32816OriginalNativeLifecycle(bundle);
    }
    private async installOwn32816OriginalNativeLifecycle(bundle:any): Promise<void> {
        assert(!this.closed&&!this.transport&&!own32816WireSlots.has(this)&&typeof bundle.createBinding==='function'&&typeof bundle.createHost==='function',
            'AG integrity: own32816 one original private lifecycle');
        this.bindOwn32816OriginalWire((privateInputs:any)=>bundle.createBinding(privateInputs));
        const slot=own32816WireSlot(this),host=bundle.createHost();slot.host=host;
        assert(host&&typeof host.boot==='function'&&typeof bundle.yieldNative==='function','AG integrity: own32816 original host callbacks');
        const lifecycle=require('./own32816-native-data/own32816-original-SG-lifecycle-DATA-v855.cjs');
        const selectors=require('./own32816-native-data/own32816-original-Main-next-request-selector-free-intro-v1.cjs');
        const money=require('./own32816-native-data/own32816-original-SG-money-projection-v853.cjs');
        const units=require('./own32816-native-data/own32816-original-SG-unit-v853.cjs');
        slot.lifecycle=lifecycle.createOwn32816OriginalSGLifecycle({sessionScope:this,game:this.game,binding:slot.binding,
            assertOriginalOpen:()=>assert(!this.closed&&!slot.error&&own32816WireSlots.get(this)===slot,'AG integrity: own32816 original session open'),
            readOriginalSessionID:()=>this.session,readOriginalCashRaw:()=>this.balance,readOriginalAction:()=>this.action,
            exchangeOriginalNative:(event:string,parameters:any)=>this.exchangeOwn32816OriginalNative(event,parameters),
            authenticateOriginalResult:(result:any,event:string)=>{
                const originalRaw=slot.originalReturnedResults.get(result);
                assert(originalRaw&&result.step===originalRaw.parsedStep&&result.step.msgId===event&&originalRaw.nativeDispatch===slot.currentDispatch,
                    'AG integrity: own32816 same private original result capability');
                assert(slot.wire.privateReaders.readAcceptedOriginalExchange(slot.currentDispatch,result.step)===originalRaw,
                    'AG integrity: own32816 original result no longer current');
                return originalRaw;
            },
            createSelector:selectors.createOwn32816OriginalMainSelector,
            createProjection:(source:any)=>money.createOwn32816OriginalSGMoneyProjection({source,readOwnOriginalUnit:units.createOwn32816OriginalSGUnitReader(source)}),
            readHost:()=>host,wallNow:()=>Date.now(),yieldNative:()=>bundle.yieldNative(host),
            timeoutMs:bundle.timeoutMs,maxTicks:bundle.maxTicks});
        try{host.boot();await slot.lifecycle.bootstrap();}catch(error){own32816WireStop(this,error);}
    }
    private async callOwn32816NativePreparation(event:string,parameters:any) {
        try{
            const slot=own32816WireSlot(this);assert(slot.lifecycle,'AG integrity: own32816 lifecycle not connected');
            const result=await slot.lifecycle.call(event,parameters);this.action=result.NextActionInfo.nextAction;return result;
        }catch(error){own32816WireStop(this,error);}
    }
    private async connectOwn32777Native(): Promise<void> {
        assert(!this.closed && !this.transport && !own32777NativeStarted.has(this),
            'AG integrity: own32777 one original live Init lifecycle');
        assert(process.env.SG_AG_ALLOW_SOURCE === '1', 'AG integrity: SG live source not enabled');
        require('./own32777-native-data/register.cjs').ensureOwn32777Registered((this.game.sg as any).own32777NativeData?.paidLifecyclePolicy);
        const nativeHostFactory=Own32777NativeHost.requireRegisteredOwn32777NativeHostFactory();
        own32777StartNativeScope(this,this.game);
        try {
            const data=(this.game.sg as any).own32777NativeData;
            assert(data?.contract==='own32777-original-AG-native-next-end-DATA-v11',
                'AG integrity: own32777 explicit native DATA contract');
            for(const key of ['maxPaidRounds','maxIntents','maxNativeTicks','maxMicrotasks','tickMilliseconds','maxTrace'])
                assert(Number.isSafeInteger(data.limits?.[key]) && data.limits[key]>0,
                    'AG integrity: own32777 explicit finite budget '+key);
            assert(data.limits.maxPaidRounds<=300000 && data.limits.tickMilliseconds<=1000,
                'AG integrity: own32777 original campaign and native clock bounds');
            const step=await this.exchange('Init',{}),envelope=this.readEnvelope(step,'Init');
            own32777CommitOriginalSuccess(this,step,envelope,this.balance);
            const connection=Own32777NativeConnection.createOwn32777OriginalAGNativeConnection({
                session:this,game:this.game,source:own32777OriginalSource,nativeHostFactory,
                limits:{...data.limits}
            });
            own32777AttachNativeConnection(this,connection);
            connection.bootstrap();
        } catch(error) {own32777ThrowPreservingOriginal(this,error,()=>this.close());}
    }
    private async callOwn32777NativeData(event:string,parameters:Record<string,any>|null) {
        let step:WireStep|undefined;
        try {
            assert(!this.closed,'AG integrity: own32777 session closed');
            const connection=own32777NativeConnection(this);
            const dispatch=await connection.take(event,parameters,this.session);
            step=await this.exchange(event,{},undefined,dispatch);
            const envelope=this.readEnvelope(step,event);
            const frame=own32777CommitOriginalSuccess(this,step,envelope,this.balance);
            const result=await connection.finish(frame,step,this.balance);
            this.action=result.NextActionInfo.nextAction;
            this.lastRequest={event,parameters:structuredClone(parameters)};
            return result;
        } catch(error) {own32777ThrowPreservingOriginal(this,error,()=>this.close());}
        finally {if(step)own32777NativeRawByStep.delete(step);}
    }
    async connect(): Promise<void> {
        if(this.game.gameId==='32761'||(this.game.sg as any).own32761ProtocolDATA){assert(this.game.gameId==='32761','AG integrity: own32761 foreign DATA');return this.connectOwn32761Protocol();}
if(this.game.gameId==='32760'||(this.game.sg as any).own32760ProtocolDATA){assert(this.game.gameId==='32760','AG integrity: own32760 foreign DATA');return this.connectOwn32760Protocol();}
        if(this.game.gameId==='32756'||(this.game.sg as any).own32756ProtocolDATA){assert(this.game.gameId==='32756','AG integrity: own32756 foreign DATA');return this.connectOwn32756Protocol();}
        if(this.game.gameId==='32763'||(this.game.sg as any).own32763ProtocolDATA){assert(this.game.gameId==='32763','AG integrity: own32763 foreign DATA');return this.connectOwn32763Protocol();}
        if(this.game.gameId==='32806'||(this.game.sg as any).own32806OriginalWire||(this.game.sg as any).own32806NativeData)return this.connectOwn32806Native();
        if(this.game.gameId==='32750')return this.connectOwn32750Native();
        if(this.game.gameId==='32816'||(this.game.sg as any).own32816OriginalWire||(this.game.sg as any).own32816NativeData){assert(this.game.gameId==='32816','AG integrity: own32816 foreign native DATA');return this.connectOwn32816NativeLive();}
        if(this.game.gameId==='32777')return this.connectOwn32777Native();
        if(this.game.gameId === '32769') {
            assert(!this.closed && !this.transport &&
                !own32769NativeInitStarted.has(this),
                'AG integrity: own32769 one original Init lifecycle only');
            own32769NativeInitStarted.add(this);
        }
        own32769PendingInit.delete(this);
        own32769ValidatedInit.delete(this);
        own32769ConsumedInitData.delete(this);
        const own32769Consumer = this.game.gameId === '32769'
            ? own32769InitConsumer : undefined;
        if(this.transport) { assert(Number.isSafeInteger(this.balance));return; }
        if(this.game.gameId === '32769')
            assert(own32769Consumer,
                'AG integrity: own32769 Init DATA factory not bound');
        assert(process.env.SG_AG_ALLOW_SOURCE === '1', 'AG integrity: SG live source not enabled');
        try {const response=await this.exchange('Init',{});const r=this.readEnvelope(response,'Init');
            if(this.game.sg.eightyFortunesContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='ReelInfo')pools.push(value);else walk(value);}};walk(r);assert(pools.length===1,'AG integrity: SG 88 own Init reels missing');
                for(const [feature,expected] of [['0',this.game.sg.eightyFortunesBaseReels],['1',this.game.sg.eightyFortunesFreeReels]]){const sets=list(pools[0].ReelSet).filter((s:any)=>s.featIndex===feature);assert(sets.every((s:any)=>s.numReels==='5'),'AG integrity: SG 88 own Init geometry');const actual=sets.map((s:any)=>integer(s.reelSetIndex,'88 Init set')).sort((a:number,b:number)=>a-b);assert(JSON.stringify(actual)===JSON.stringify(expected),'AG integrity: SG 88 own Init declared sets changed');}
            }
            if(this.game.sg.goldenChiefCanyonTrailContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='CashCanyons')pools.push(value);else walk(value);}};walk(r);
                assert(pools.length===1&&Object.keys(pools[0]).join('|')==='Canyon','AG integrity: SG Golden own Init Canyon table missing');
                const rows=list(pools[0].Canyon).sort((a:any,b:any)=>Number(a.canyonID)-Number(b.canyonID));
                assert(rows.length===10&&rows.every((p:any,i:number)=>p.canyonID===String(i)&&Object.keys(p).sort().join('|')==='canyonID|prizes'),'AG integrity: SG Golden own Init Canyon schema');
                const actual=rows.map((p:any)=>p.prizes.split('|').map((n:string)=>{assert(/^(?:0|[1-9]\d*)(?:\.[05])?$/.test(n),'AG integrity: SG Golden own Init Canyon half-unit');const v=Number(n)*2;assert(Number.isSafeInteger(v)&&v>0,'AG integrity: SG Golden own Init Canyon prize');return v;}));
                assert(JSON.stringify(actual)===JSON.stringify(this.game.sg.goldenChiefCanyonPrizes2x),'AG integrity: SG Golden own Init Canyon table changed');
            }
            if(this.game.sg.goldenChiefTotemLifeContract){
                const pools:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;for(const [k,value] of Object.entries(v)){if(k==='TotemPoles')pools.push(value);else walk(value);}};walk(r);
                assert(pools.length===1,'AG integrity: SG Golden own Init Totem data missing');
                for(const type of ['0','1']){const rows=list(pools[0].Pole).filter((p:any)=>p.gameMode==='1'&&p.totemType===type).sort((a:any,b:any)=>Number(a.id)-Number(b.id));assert(rows.length===3&&rows.every((p:any,i:number)=>p.id===String(i)&&Object.keys(p).sort().join('|')==='gameMode|id|prizes|totemType'),'AG integrity: SG Golden own Init Totem columns');const actual=rows.map((p:any)=>p.prizes.split('|').map((n:string)=>integer(n,'Totem Init prize')));assert(JSON.stringify(actual)===JSON.stringify(this.game.sg.goldenChiefTotemTrails[type]),'AG integrity: SG Golden own Init Totem trail changed');}
            }
            if(this.game.gameId === '32769') {
                assert(!this.closed, 'AG integrity: own32769 Init closed before consumption');
                const frame = own32769LiveInitByStep.get(response);
                assert(frame && frame.sessionScope === this,
                    'AG integrity: own32769 missing live Init association');
                assert(frame.nativeGameID === '20135'
                    && frame.gameCodeRGI === 'fudaole'
                    && frame.nativeVersionID === '1_0',
                    'AG integrity: own32769 native Init binding');
                own32769PendingInit.set(this, frame);
                const consumer = own32769Consumer;
                let consumed: unknown;
                if(consumer) consumed = await consumer(
                    this, own32769SourceDuringConsumption(this)
                );
                assert(!this.closed, 'AG integrity: own32769 Init closed during consumption');
                own32769PendingInit.delete(this);
                own32769ValidatedInit.set(this, frame);
                if(consumer) own32769ConsumedInitData.set(this, consumed);
                const nativeBridge =
                    Own32769NativeConnection.createOwn32769OriginalAGNativeBridge({
                        session: this, game: this.game,
                        sgSessionExports: {readOwn32769ConsumedInitData},
                        originalGameplaySource: own32769OriginalGameplaySource,
                        initialBalanceRaw: this.balance,
                        limits: {
                            maxDrawingCommands: 250000, maxDataIntents: 128,
                            maxObserverRecords: 16000, maxObserverCohorts: 64,
                            maxPresentationTicks: 2000
                        }
                    });
                own32769NativeBridges.set(this, nativeBridge);
            }
        }
        catch(error) {
            own32769PendingInit.delete(this);
            own32769ValidatedInit.delete(this);
            own32769ConsumedInitData.delete(this);
            if(this.game.gameId==='32769')this.own32769ClosePreserving(error);
            this.close();throw error;
        }
    }
    getHandshakeData() { return null; } // no AG-format handshake is fabricated
    getBalance() { return this.balance/100; }
    getFallbackBet() { return this.game.sg.betRaw/100; }
    getSpinParams() { return {...this.game.sg.stake}; }
    getPickProtocol(action:string,response?:any) {
        if(this.game.gameId==='32761'){const slot=own32761ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32761 private choice connection required');return slot.connection.pickProtocol(action,response);}
if(this.game.gameId==='32760'){const slot=own32760ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32760 private choice connection required');return slot.connection.pickProtocol(action,response);}
        if(this.game.gameId==='32777')return own32777NativeConnection(this).pickProtocol(action);
        if(this.game.gameId==='32769')return own32769NativeBridge(this).pickProtocol(action);
        if(action!=='PICK_FREE_SPINS'||this.game.sg.goldenChiefPaidContract!=='golden-chief-own-totem-v6')return undefined;
        assert(this.game.gameId==='32771'&&this.game.dbName==='sg_golden_chief'&&this.action===action&&this.free?.freeSpinsPlayed===0&&this.free.freeSpinsTotal>0,'AG integrity: SG Golden Chief collect protocol scope');
        return {kind:'choice' as const,event:'Logic',options:[{pickIndex:1,requestPickIndex:1,requestParams:{__sgGoldenCollect:'1'}}]};
    }
    getPickParams(_index: number|string) {
        if(this.game.gameId==='32769') {
            const protocol = own32769NativeBridge(this).pickProtocol('PICK');
            const option = protocol.options.find((row: any) =>
                String(row.pickIndex) === String(_index));
            assert(option, 'AG integrity: own32769 native pick selector unavailable');
            return option.requestParams;
        }
        throw new Error('AG integrity: SG pick protocol not mapped');
    }
    getInitialRoundRequest() { if(this.game.gameId==='32761'){const slot=own32761ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32761 private connection required');return slot.connection.initial();}
if(this.game.gameId==='32760'){const slot=own32760ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32760 private connection required');return slot.connection.initial();} if(this.game.gameId==='32756'){const slot=own32756ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32756 private connection required');return slot.connection.initial();} if(this.game.gameId==='32763'){const slot=own32763ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32763 original connection required');return slot.connection.initial();} if((this.game.sg as any).own32816OriginalWire){const slot=own32816WireSlot(this);assert(slot.lifecycle,'AG integrity: own32816 native lifecycle not connected');return slot.lifecycle.initial();} if((this.game.sg as any).own32806OriginalWire){const slot=own32806WireSlot(this);assert(slot.lifecycle,'AG integrity: own32806 native lifecycle not connected');return slot.lifecycle.initial();} if(this.game.gameId==='32750'){try{const slot=own32750Slot(this),cap=slot.ownerHooks.issueOriginalAGPaidIntent(this.action,this.session);return slot.connection.initial(cap);}catch(error){own32750Stop(this,error,()=>this.close());}} if(this.game.gameId==='32777'){try{const cap=own32777IssueOriginalAGPaidIntent(this,this.action,this.session);return own32777NativeConnection(this).initial(cap);}catch(error){own32777ThrowPreservingOriginal(this,error,()=>this.close());}}if(this.game.gameId==='32769')return own32769NativeBridge(this).initial();return {event:'Logic',parameters:this.getSpinParams()}; }
    getLastGameRequest() { if((this.game.sg as any).own32816OriginalWire)return own32816WireSlot(this).lifecycle.getLastGameRequest(); if((this.game.sg as any).own32806OriginalWire)return own32806WireSlot(this).lifecycle.getLastGameRequest(); if(this.game.gameId==='32750')return own32750Slot(this).connection.getLastGameRequest();return this.lastRequest; }
    isRoundTerminalAction(action: string) { return action === 'SPIN'; }
    getExactFollowUpRequest(action: string) {
        if(this.game.gameId==='32761'){const slot=own32761ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32761 private connection required');return slot.connection.exact(action);}
if(this.game.gameId==='32760'){const slot=own32760ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32760 private connection required');return slot.connection.exact(action);}
        if(this.game.gameId==='32756'){const slot=own32756ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32756 private connection required');return slot.connection.exact(action);}
        if(this.game.gameId==='32763'){const slot=own32763ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32763 original connection required');return slot.connection.exact(action);}
        if((this.game.sg as any).own32806OriginalWire)return own32806WireSlot(this).lifecycle.exact(action);
        if(this.game.gameId==='32750')return own32750Slot(this).connection.exact(action);
        if((this.game.sg as any).own32816OriginalWire)return own32816WireSlot(this).lifecycle.exact(action);
        if(this.game.gameId==='32777')return own32777NativeConnection(this).exact(action);
        if(this.game.gameId==='32769')return own32769NativeBridge(this).exact(action);
        if(action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')return {event:'Logic',parameters:{__sgGoldenCollect:'1'}};
        if(action==='FEATURE'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')return {event:'EndGame',parameters:{}};
        if(action === 'PLAY') return {event:'EndGame',parameters:{}};
        if(action==='FREE_SPIN'&&this.game.sg.ownDCNextEndContract){ownDCFlowBinding(this.game);assert(this.free&&this.free.freeSpinsRemaining>0,'AG integrity: SG DC actual continuation selector missing');return {event:'Logic',parameters:{...this.game.sg.stake}};}
        if(action==='FREE_SPIN'&&this.game.sg.fudaFreeContract==='fuda-own-natural-free-v4')return {event:'Logic',parameters:{totalStake:'200'}};
        if(action === 'FREE_SPIN') { assert(this.game.sg.freeStake,'AG integrity: SG own free request not mapped');return {event:'Logic',parameters:{...this.game.sg.freeStake}}; }
        throw new Error('AG integrity: SG observed action not mapped');
    }
    private payload(event:string,parameters:Record<string,any>) {
        const h={...this.game.sg.header,sessionID:this.session};
        const header='<Header '+Object.entries(h).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';
        if(this.game.sg.ownDCNextEndContract&&(event==='Logic'||event==='EndGame')){
            const c=ownDCFlowBinding(this.game);
            if(event==='Logic'){assert((this.action==='SPIN'||this.action==='FREE_SPIN'&&this.free&&this.free.freeSpinsRemaining>0)&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG DC exact paid/free Logic request');return `<GameRequest type="Logic">${header}${c.logicRequestDataXML}</GameRequest>`;}
            assert(this.action==='PLAY'&&Object.keys(parameters).length===0,'AG integrity: SG DC actual EndGame request');return `<GameRequest type="EndGame">${header}${c.endRequestDataXML}</GameRequest>`;
        }
        if(event==='Logic'&&this.game.sg.ownQuickHitPaidContract){const c=ownQuickHitPaidBinding(this.game);assert((this.action==='SPIN'||this.action==='FREE_SPIN'&&['own-quick-hit-client-features-v4','own-quick-hit-client-free-shape-v5','own-quick-hit-client-empty-shape-v7','own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(c.version))&&JSON.stringify(parameters)===JSON.stringify({total:'200'}),'AG integrity: SG Quick Hit own paid/free current stake request');return `<GameRequest type="Logic">${header}${c.paidRequestDataXML}</GameRequest>`;}
        if(event==='Logic'&&this.game.sg.healthyComponentsContract){const kind=ownHealthyComponentsBinding(this.game);if(this.action==='FREE_SPIN'){assert(kind!=='jinji'&&Object.keys(parameters).length===0,'AG integrity: SG healthy free request');return `<GameRequest type="Logic">${header}</GameRequest>`;}assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(this.game.sg.stake),'AG integrity: SG healthy paid request');const ownStake='<Stake '+Object.entries(parameters).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>';if(kind==='megaways')return `<GameRequest type="Logic">${header}${ownStake}<PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>${ownStake}</GameRequest>`;}
        if(event==='Logic'&&this.game.sg.eightyFortunesContract&&Object.keys(parameters).length){assert(this.action==='SPIN'&&this.game.gameId==='32750'&&JSON.stringify(parameters)===JSON.stringify({creditBet:'88',betMultiplier:'2'}),'AG integrity: SG 88 Fortunes own paid request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><SpinInfo creditBet="88" betMultiplier="2"/></GameRequest>`;}
        if(event==='Logic'&&this.game.sg.zeusThreeContract){assert(this.game.gameId==='32816'&&this.game.dbName==='sg_zeus3_prt'&&this.game.sg.betRaw===40,'AG integrity: SG Zeus III request binding');if(this.action==='FREE_SPIN'){assert(Object.keys(parameters).length===0,'AG integrity: SG Zeus III free request');return `<GameRequest type="Logic">${header}</GameRequest>`;}assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify({totalStake:'40'}),'AG integrity: SG Zeus III paid request');return `<GameRequest type="Logic">${header}<WagerInfo totalStake="40"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;}
        if(event==='Logic'&&this.game.sg.logicRequestNode==='WagerInfo'){
            if(this.game.sg.fudaPaidContract){if(this.action==='FREE_SPIN'){assert(this.game.gameId==='32769'&&this.game.sg.fudaFreeContract==='fuda-own-natural-free-v4'&&JSON.stringify(parameters)===JSON.stringify({totalStake:'200'}),'AG integrity: SG Fu own free wager');return `<GameRequest type="Logic">${header}<WagerInfo totalStake="200"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;}assert(this.action==='SPIN'&&this.game.gameId==='32769'&&this.game.sg.fudaPaidContract==='fuda-own-natural-paid-display-v3'&&JSON.stringify(parameters)===JSON.stringify({totalStake:'200',featureBet:'0'}),'AG integrity: SG Fu Dao Le own request');return `<GameRequest type="Logic">${header}<WagerInfo totalStake="200" featureBet="0"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></GameRequest>`;}
            assert(this.game.gameId==='32767'&&this.game.sg.fireQueenPaidContract==='fire-queen-own-paid-v1'&&this.action==='SPIN'&&Object.keys(parameters).join('|')==='totalStake'&&parameters.totalStake==='50','AG integrity: SG Fire Queen own request');
            return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><WagerInfo totalStake="50"/></GameRequest>`;
        }
        if(Object.prototype.hasOwnProperty.call(parameters,'__sgGoldenCollect')){assert(event==='Logic'&&this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&Object.keys(parameters).length===1&&parameters.__sgGoldenCollect==='1','AG integrity: SG Golden Chief collect request');return `<GameRequest type="Logic">${header}<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData><Gamble collect="1"/></GameRequest>`;}
        const stake=Object.keys(parameters).length?'<Stake '+Object.entries(parameters).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')+'/>':'';
        if(event==='Logic'&&(this.game.sg.desertCatsContract||this.game.sg.jinjiEndlessContract)) {
            const kind=ownHealthyPaidBinding(this.game);
            assert(this.action==='SPIN'&&JSON.stringify(parameters)===JSON.stringify(kind==='desert'?{total:'200'}:{total:'16',gameMode:'0'}),'AG integrity: SG own healthy paid request');
            return `<GameRequest type="Logic"><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>${header}${stake}<PaylineCount count="${this.game.sg.logicPaylineCount}"/></GameRequest>`;
        }
        // Own Dragon client serializes AccountData for a stake-less free Logic too.
        // This is an explicit per-game wire binding, never a guessed feature stake.
        const freeAccount = event==='Logic' && !stake && this.game.sg.freeLogicCurrencyMultiplier !== undefined;
        if(freeAccount) assert(this.game.sg.freeLogicCurrencyMultiplier==='1','AG integrity: SG own free currency binding');
        return `<GameRequest type="${event}">${stake?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${header}${freeAccount?'<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':''}${stake}</GameRequest>`;
    }
    private async exchange(event:string,parameters:Record<string,any>,own32769Dispatch?:any,own32777Dispatch?:any,own32750Dispatch?:any,own32806Dispatch?:any,own32816Dispatch?:any):Promise<WireStep> {
        assert(!this.closed,'AG integrity: SG session closed');
        const requestSessionID=this.session;
        const own32761Slot=own32761ProtocolSlots.get(this);
const own32760Slot=own32760ProtocolSlots.get(this);
        const own32761Dispatch=own32761Slot?.connection.consume(event,parameters,requestSessionID);
const own32760Dispatch=own32760Slot?.connection.consume(event,parameters,requestSessionID);
        const own32756Slot=own32756ProtocolSlots.get(this);
        const own32756Dispatch=own32756Slot?.connection.consume(event,parameters,requestSessionID);
        const own32763Slot=own32763ProtocolSlots.get(this);
        const own32763Dispatch=own32763Slot?.connection.consume(event,parameters,requestSessionID);
        if((this.game.sg as any).own32816OriginalWire){const slot=own32816WireSlot(this);assert(this.game.gameId==='32816'&&!this.transport&&own32816Dispatch&&slot.currentDispatch===own32816Dispatch&&slot.consumed.has(own32816Dispatch)&&own32816Dispatch.event===event&&!own32769Dispatch&&!own32777Dispatch&&!own32750Dispatch&&!own32806Dispatch,'AG integrity: own32816 exclusive consumed original dispatch');}else assert(!own32816Dispatch,'AG integrity: own32816 foreign native dispatch');
        if((this.game.sg as any).own32806OriginalWire){const slot=own32806WireSlot(this);assert(this.game.gameId==='32806'&&!this.transport&&own32806Dispatch&&slot.currentDispatch===own32806Dispatch&&slot.consumed.has(own32806Dispatch)&&own32806Dispatch.event===event&&!own32769Dispatch&&!own32777Dispatch,'AG integrity: own32806 exclusive consumed original dispatch');}else assert(!own32806Dispatch,'AG integrity: own32806 foreign native dispatch');
        if(this.game.gameId==='32750')assert(!this.transport&&own32750Dispatch&&own32750Dispatch.event===event&&!own32769Dispatch&&!own32777Dispatch,'AG integrity: own32750 exclusive native original dispatch');
        else assert(!own32750Dispatch,'AG integrity: own32750 native dispatch foreign game');
        if(this.game.gameId==='32769' && event!=='Init')
            assert(own32769Dispatch && own32769Dispatch.event===event,
                'AG integrity: own32769 native request DATA required');
        else assert(!own32769Dispatch,'AG integrity: native request DATA scope');
        if(this.game.gameId==='32777' && event!=='Init')assert(own32777Dispatch,
            'AG integrity: own32777 current native request DATA required');
        else assert(!own32777Dispatch,'AG integrity: own32777 native dispatch game scope');
        const payload=own32761Dispatch ? own32761Dispatch.requestPayload : own32760Dispatch ? own32760Dispatch.requestPayload : own32756Dispatch ? own32756Dispatch.requestPayload : own32763Dispatch ? own32763Dispatch.requestPayload : own32816Dispatch ? own32816Dispatch.requestPayload : own32806Dispatch ? own32806Dispatch.requestPayload : own32750Dispatch
            ? own32750Slot(this).ownerHooks.consumeNativeBeforeOriginalPost(own32750Dispatch,requestSessionID) : own32777Dispatch
            ? own32777ConsumeNativeDispatch(this,event,own32777Dispatch,requestSessionID) : own32769Dispatch
            ? own32769Dispatch.requestPayload : this.payload(event,parameters);
        const ordinal=++this.ordinal;
        const requestKind = event==='Init' ? 'initialization' : this.action==='SPIN' ? 'round-start' : 'round-follow-up';
        if(event!=='Init')this.gameplayRequestHasBeenSent=true;
        const context: SGRequestEvidence = {event,ordinal,requestKind,gameplayRequestHasBeenSent:this.gameplayRequestHasBeenSent};
        if(this.transport) {
            const step=await this.transport(event,payload);
            if(step.httpStatus!==undefined && !(step.httpStatus>=200 && step.httpStatus<300)) {
                const fault=httpSourceFault({...context,httpStatus:step.httpStatus,responseSHA256:crypto.createHash('sha256').update(step.responsePayload).digest('hex')});
                this.close();throw this.closedFaultForFutureSession(fault);
            }
            if(own32761Dispatch)own32761Slot.connection.rememberOriginalWire({dispatch:own32761Dispatch,step,requestSessionID,httpStatus:step.httpStatus,offlineControlledTransport:true});
if(own32760Dispatch)own32760Slot.connection.rememberOriginalWire({dispatch:own32760Dispatch,step,requestSessionID,httpStatus:step.httpStatus,offlineControlledTransport:true});
            if(own32756Dispatch)own32756Slot.connection.rememberOriginalWire({dispatch:own32756Dispatch,step,requestSessionID,httpStatus:step.httpStatus,offlineControlledTransport:true});
            if(own32763Dispatch)own32763Slot.connection.rememberOriginalWire({dispatch:own32763Dispatch,step,requestSessionID,httpStatus:step.httpStatus,offlineControlledTransport:true});
            return step;
        }
        const requestHeaders = {'Content-Type':own32761Dispatch ? own32761Dispatch.requestHeaders[0][1] : own32760Dispatch?own32760Dispatch.requestHeaders[0][1]:(own32756Dispatch||own32763Dispatch)?'text/xml':'text/xml; charset=utf-8',
            ...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})};
        const own32769Journal = own32761Dispatch ? {endpoint:this.game.sg.endpoint,method:'POST',own32761ProtocolDATA:true,originalAGRoundOrdinal:own32761Dispatch.roundScope?.roundOrdinal} : own32760Dispatch ? {endpoint:this.game.sg.endpoint,method:'POST',own32760ProtocolDATA:true,originalAGRoundOrdinal:own32760Dispatch.roundScope?.roundOrdinal} : own32756Dispatch ? {endpoint:this.game.sg.endpoint,method:'POST',own32756ProtocolDATA:true,originalAGRoundOrdinal:own32756Dispatch.roundScope?.roundOrdinal} : own32763Dispatch ? {endpoint:this.game.sg.endpoint,method:'POST',own32763ProtocolDATA:true,originalAGRoundOrdinal:own32763Dispatch.roundScope?.roundOrdinal} : this.game.gameId==='32777' ? {endpoint:this.game.sg.endpoint,method:'POST',nativeRoundOrdinal:own32777Dispatch?.intent?.originalAGRoundIntent?.roundOrdinal,nativeRequestDATA:!!own32777Dispatch} : this.game.gameId==='32769' ? {
            endpoint:this.game.sg.endpoint, method:'POST',
            nativeRoundId:own32769Dispatch?.roundId,
            nativeRequestDATA:!!own32769Dispatch
        } : {};
        this.evidence({phase:'intent',ordinal,event,payload,
            ...(['32769','32777','32763','32756'].includes(this.game.gameId)?{...own32769Journal,requestHeaders}: {})});
        const own32816Headers=own32816Dispatch ? new Headers(own32816Dispatch.requestHeaders) : undefined;
        if(own32816Headers&&this.cookies.size)own32816Headers.set('Cookie',[...this.cookies].map(([k,v])=>k+'='+v).join('; '));
        if(own32816Dispatch)this.evidence({phase:'own32816-native-original-request-DATA',ordinal,event,payload,requestHeaders:Array.from(own32816Headers!.entries())});
        if(own32750Dispatch)this.evidence({phase:'own32750-native-original-request-DATA',ordinal,event,requestHeaders,nativeRequestHeaders:own32750Dispatch.requestHeaders});
        const own32806Headers=own32806Dispatch ? new Headers(own32806Dispatch.requestHeaders) : undefined;
        if(own32806Headers&&this.cookies.size)own32806Headers.set('Cookie',[...this.cookies].map(([k,v])=>k+'='+v).join('; '));
        if(own32806Dispatch)this.evidence({phase:'own32806-native-original-request-DATA',ordinal,event,payload,requestHeaders:Array.from(own32806Headers!.entries())});
        const start=Date.now(),deadline=sgRequestTimeoutMs(this.game);let response:Response | undefined,text:string;
        try {
            response=await fetch(this.game.sg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(deadline),
                headers:own32816Headers||own32806Headers||requestHeaders,body:payload});
            text=await response.text();
        } catch(error) {
            const fault=transportSourceFault(context);
            this.evidence({phase:'unknown',ordinal,event,...own32769Journal,...sourceFaultMetadata(fault),transportDiagnostic:sgTransportDiagnostic(error,start,deadline,Date.now(),response?.status)});
            if(own32750Dispatch)own32750Stop(this,fault,()=>this.close());
            if(own32806Dispatch)own32806WireStop(this,fault);
            if(own32816Dispatch)own32816WireStop(this,fault);
            if(this.game.gameId==='32769')this.own32769ClosePreserving(fault);
            this.close();
            throw this.closedFaultForFutureSession(fault);
        }
        assert(response,'AG integrity: SG missing transport response');
        const fault=response.ok ? null : httpSourceFault({...context,httpStatus:response.status,responseSHA256:crypto.createHash('sha256').update(text).digest('hex')});
        this.evidence({phase:'response',ordinal,event,httpStatus:response.status,text,
            ...(['32769','32777','32763','32756'].includes(this.game.gameId)?{...own32769Journal,
                responseHeaders:Array.from(response.headers.entries()),
                responseSetCookie:response.headers.getSetCookie?.() || []}:{}),
            ...(fault ? sourceFaultMetadata(fault) : {})});
        if(own32750Dispatch)this.evidence({phase:'own32750-native-original-response-DATA',ordinal,event,httpStatus:response.status,responseHeaders:Array.from(response.headers.entries()),responseSetCookie:response.headers.getSetCookie?.()||[]});
        if(fault&&own32750Dispatch)own32750Stop(this,fault,()=>this.close());
        if(own32816Dispatch)this.evidence({phase:'own32816-native-original-response-DATA',ordinal,event,httpStatus:response.status,responseHeaders:Array.from(response.headers.entries()),responseSetCookie:response.headers.getSetCookie?.()||[]});
        if(fault&&own32816Dispatch)own32816WireStop(this,fault);
        if(own32806Dispatch)this.evidence({phase:'own32806-native-original-response-DATA',ordinal,event,httpStatus:response.status,responseHeaders:Array.from(response.headers.entries()),responseSetCookie:response.headers.getSetCookie?.()||[]});
        if(fault&&own32806Dispatch)own32806WireStop(this,fault);
        if(fault){if(this.game.gameId==='32769')this.own32769ClosePreserving(fault);this.close();throw this.closedFaultForFutureSession(fault);}
        for(const cookie of response.headers.getSetCookie?.() || []) {const pair=cookie.split(';')[0],at=pair.indexOf('=');if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
        const step: WireStep = {
            msgId:event,requestPayload:payload,responsePayload:text,
            elapsedMs:Date.now()-start
        };
        if(own32761Dispatch)own32761Slot.connection.rememberOriginalWire({dispatch:own32761Dispatch,step,requestSessionID,httpStatus:response.status,responseHeaders:response.headers});
if(own32760Dispatch)own32760Slot.connection.rememberOriginalWire({dispatch:own32760Dispatch,step,requestSessionID,httpStatus:response.status,responseHeaders:response.headers});
        if(own32756Dispatch)own32756Slot.connection.rememberOriginalWire({dispatch:own32756Dispatch,step,requestSessionID,httpStatus:response.status,responseHeaders:response.headers});
        if(own32763Dispatch)own32763Slot.connection.rememberOriginalWire({dispatch:own32763Dispatch,step,requestSessionID,httpStatus:response.status,responseHeaders:response.headers});
        if(own32750Dispatch)own32750Slot(this).ownerHooks.rememberOriginalRaw({step,response,ordinal,requestSessionID,requestHeaders,journalPath:this.journalPath});
        if(own32816Dispatch)own32816WireSlot(this).wire.ownerHooks.rememberOriginalWire({dispatch:own32816Dispatch,step,response,ordinal,requestSessionID,actualRequestHeaders:own32816Headers});
        if(own32806Dispatch)own32806WireSlot(this).wire.ownerHooks.rememberOriginalWire({dispatch:own32806Dispatch,step,response,ordinal,requestSessionID,actualRequestHeaders:own32806Headers});
        if(this.game.gameId==='32777')own32777RememberOriginalRaw(this,this.game,step,response,ordinal,requestSessionID,requestHeaders,this.journalPath,own32777Dispatch);
        if(event === 'Init' && this.game.gameId === '32769') {
            const frame: Own32769OriginalInitFrame = Object.freeze({
                kind: 'original-ag-live-Init-wire-DATA-only' as const,
                sessionScope: this,
                game: this.game,
                step,
                msgId: event,
                requestPayload: payload,
                responsePayload: text,
                endpoint: this.game.sg.endpoint,
                ordinal,
                initialSessionID: requestSessionID,
                httpStatus: response.status,
                responseHeaders: response.headers,
                response,
                nativeGameID: String(this.game.sg.header.gameID),
                gameCodeRGI: String(this.game.sg.header.gameCodeRGI),
                nativeVersionID: String(this.game.sg.header.versionID),
                runtimeGameId: this.game.sg.runtimeGameId
            });
            own32769IssuedInit.add(frame);
            own32769LiveInitByStep.set(step, frame);
        }
        if(this.game.gameId === '32769' && event !== 'Init') {
            assert(!this.closed && own32769Dispatch &&
                own32769Dispatch.intent.requestPayload === payload,
                'AG integrity: own32769 late/replaced native gameplay frame');
            const frame = Object.freeze({
                kind: 'original-ag-unvalidated-gameplay-wire-DATA-only',
                sessionScope: this, roundScope: own32769Dispatch.roundScope,
                game: this.game, step, msgId: event,
                requestPayload: payload, responsePayload: text,
                endpoint: this.game.sg.endpoint, ordinal,
                requestSessionID, httpStatus: response.status,
                responseHeaders: response.headers, response,
                nativeIntent: own32769Dispatch.intent,
                journalPath: this.journalPath
            });
            own32769NativeRawByStep.set(step, frame);
        }
        return step;
    }
    private closedFaultForFutureSession(fault:SGSourceFault):Error {
        if(this.game.gameId==='32761')return own32761Hold(fault);
if(this.game.gameId==='32760')return own32760Hold(fault);
        if(this.game.gameId==='32756')return own32756Hold(fault);
        if(this.game.gameId==='32763')return own32763Hold(fault);
        if(this.game.gameId==='32750')return own32750Integrity(fault);
        if(this.game.gameId==='32769')return fault;
        if(fault.category!=='execution-unknown' || !this.game.sg.unknownFreeSessionRecovery)return fault;
        assert(this.game.sg.unknownFreeSessionRecovery==='original-ag-discard-free-v1',
            'AG integrity: SG unknown Free session recovery contract');
        assert(this.game.sg.header.freePlay==='Y'&&this.closed&&this.cookies.size===0
            &&/^Free:[0-9a-f]{32}$/.test(this.freshFreeId),
            'AG integrity: SG old uncertain session not sealed');
        if(!['Logic','EndGame'].includes(fault.evidence.event))return fault;
        const status=fault.evidence.httpStatus;
        if(status!==undefined && ![408,425,429,500,502,503,504,520,521,522,523,524].includes(status))return fault;
        // The old outcome stays unknown and cannot be retried. Only a later,
        // independent Free session is eligible under original AG finite reset.
        this.evidence({phase:'sealed-session-recovery',ordinal:fault.evidence.ordinal,
            event:fault.evidence.event,oldOutcomeStillUnknown:true,oldRequestReplays:0,
            retryAction:'original-ag-discard-then-new-free-session'});
        return new SGClosedFreeSessionDiscard(fault);
    }
    private readEnvelope(step:WireStep,event:string) {
        const r=xml.parse(step.responsePayload)?.GameResponse;
        assert(r && r.type===event && r.Header && !r.Error && !r.Errors,'AG integrity: SG response envelope');
        assert(String(r.Header.gameID)===String(this.game.sg.header.gameID),'AG integrity: SG response game');
        assert(typeof r.Header.sessionID==='string'&&r.Header.sessionID.length>0,'AG integrity: SG response session');
        const balances=list(r.Balances?.Balance).filter(b=>b.name==='CASH_BALANCE');assert(balances.length===1,'AG integrity: SG cash balance');
        this.balance=integer(balances[0].value,'cash balance');this.session=r.Header.sessionID;
        const own32761=own32761ProtocolSlots.get(this);
const own32760=own32760ProtocolSlots.get(this);if(own32761)own32761.connection.commitAfterOriginalReadEnvelope(step,r);
if(own32760)own32760.connection.commitAfterOriginalReadEnvelope(step,r);
        const own32756=own32756ProtocolSlots.get(this);if(own32756)own32756.connection.commitAfterOriginalReadEnvelope(step,r);
        const own32763=own32763ProtocolSlots.get(this);if(own32763)own32763.connection.commitAfterOriginalReadEnvelope(step,r);
        const own32816=own32816WireSlots.get(this);if(own32816){own32816.acceptedEnvelopes.set(step,r);own32816.wire.ownerHooks.commitAfterOriginalReadEnvelope(step,r);}
        const own32806=own32806WireSlots.get(this);if(own32806){own32806.acceptedEnvelopes.set(step,r);own32806.wire.ownerHooks.commitAfterOriginalReadEnvelope(step,r);}
        return r;
    }
    private own32769ClosePreserving(error: unknown): never {
        try {
            this.close();
        } catch (cleanupError) {
            own32769NativeCleanupFailure.set(this, cleanupError);
        }
        throw error;
    }
    private async callOwn32769NativeData(
        event: string, parameters: Record<string, any> | null
    ): Promise<Record<string, any>> {
        assert(!this.closed, 'AG integrity: own32769 session closed');
        const bridge = own32769NativeBridge(this);
        let step: WireStep | undefined;
        try {
            const dispatch = bridge.take(event, parameters, this.session);
            step = await this.exchange(event, {}, dispatch);
            this.readEnvelope(step, event);
            const raw = own32769NativeRawByStep.get(step);
            assert(!this.closed && raw && raw.sessionScope === this &&
                own32769ValidatedInit.has(this),
                'AG integrity: own32769 raw success association missing');
            // Issue only after original readEnvelope returns successfully.
            const frame = Object.freeze({...raw,
                kind: 'original-ag-live-gameplay-wire-DATA-only'});
            own32769NativeIssuedFrames.add(frame);
            own32769NativeCurrentFrame.set(this, frame);
            own32769NativeRawByStep.delete(step);
            const data = bridge.finish(frame, step, this.balance);
            this.action = data.NextActionInfo.nextAction;
            this.lastRequest = {event, parameters: structuredClone(parameters)};
            return data;
        } catch (error) {
            try {
                bridge.fail(error);
            } catch (cleanupError) {
                own32769NativeCleanupFailure.set(this, cleanupError);
            } finally {
                this.own32769ClosePreserving(error);
            }
        } finally {
            if (step) own32769NativeRawByStep.delete(step);
        }
    }
    async callGameData(event:string,parameters:Record<string,any>|null) {
        if(this.game.gameId==='32761'){const slot=own32761ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32761 private connection absent');try{const result=await this.callOriginalWmsGameData(event,parameters);return slot.connection.finishOriginalResult(event,result);}catch(error){slot.connection.seal(error);this.close();throw own32761Hold(error);}}
if(this.game.gameId==='32760'){const slot=own32760ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32760 private connection absent');try{const result=await this.callOriginalWmsGameData(event,parameters);return slot.connection.finishOriginalResult(event,result);}catch(error){slot.connection.seal(error);this.close();throw own32760Hold(error);}}
        if(this.game.gameId==='32756'){const slot=own32756ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32756 private connection absent');try{const result=await this.callOriginalWmsGameData(event,parameters);return slot.connection.finishOriginalResult(event,result);}catch(error){slot.connection.seal(error);this.close();throw own32756Hold(error);}}
        if(this.game.gameId!=='32763')return this.callOriginalWmsGameData(event,parameters);
        const slot=own32763ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32763 private connection absent');
        try{const result=await this.callOriginalWmsGameData(event,parameters);return slot.connection.finishOriginalResult(event,result);}
        catch(error){slot.connection.seal(error);this.close();throw own32763Hold(error);}
    }
    private async callOriginalWmsGameData(event:string,parameters:Record<string,any>|null) {
        if((this.game.sg as any).own32816OriginalWire)return this.callOwn32816NativePreparation(event,parameters);
        if((this.game.sg as any).own32806OriginalWire)return this.callOwn32806NativePreparation(event,parameters);
        if(this.game.gameId==='32750')return this.callOwn32750NativeData(event,parameters);
        if(this.game.gameId==='32777')return this.callOwn32777NativeData(event,parameters);
        if(this.game.gameId==='32769')return this.callOwn32769NativeData(event,parameters);
        const first=this.action==='SPIN';
        if(first) {assert(event==='Logic','AG integrity: SG round start');this.startBalance=this.balance;this.totalWin=0;this.free=undefined;this.steps=[];this.lastBase=undefined;this.eightyBase=undefined;this.fudaBase=undefined;this.coolJewelsBase=undefined;this.goldenPending=undefined;}
        else assert(event===this.getExactFollowUpRequest(this.action).event,'AG integrity: SG request order');
        assert(Number.isSafeInteger(this.startBalance),'AG integrity: SG missing initial balance');
        const step=await this.exchange(event,parameters || {}),r=this.readEnvelope(step,event);
        if(this.game.sg.healthyComponentsContract){assert(Object.keys(r).every(k=>['type','Header','AccountData','Balances','GameResult',...(this.game.gameId==='32777'?['SymbolGrids']:[])].includes(k)),'AG integrity: SG healthy response schema');if(r.SymbolGrids!==undefined)assert(this.game.gameId==='32777'&&r.SymbolGrids==='','AG integrity: SG healthy symbols envelope changed');}
        this.steps.push({...step,responseBalance:this.balance});this.lastRequest={event,parameters:structuredClone(parameters)};
        if(event==='EndGame') {
            assert(!r.GameResult,'AG integrity: SG unexpected EndGame result');
            assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG final balance mismatch');
            this.action='SPIN';
        } else {
            const g=r.GameResult;
            if(this.game.gameId==='32761'){const slot=own32761ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32761 mapping absent');const mapped=slot.connection.currentOriginalMapping(g,first);this.totalWin=mapped.win;this.free=mapped.free;this.action=mapped.next;}else if(this.game.gameId==='32760'){const slot=own32760ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32760 mapping absent');const mapped=slot.connection.currentOriginalMapping(g,first);this.totalWin=mapped.win;this.free=mapped.free;this.action=mapped.next;}
            else if(this.game.gameId==='32756'){const slot=own32756ProtocolSlots.get(this);assert(slot?.connection,'AG integrity: own32756 mapping absent');const mapped=slot.connection.currentOriginalMapping(g,first);this.totalWin=mapped.win;this.free=mapped.free;this.action=mapped.next;}
            else if(this.game.sg.ownDCNextEndContract){const mapped=validateOwnDCFlow(this.game,g,first,this.free,r);this.totalWin=mapped.win;this.free=mapped.free;this.action=mapped.next;}
            else if(this.game.sg.zeusThreeContract){const mapped=validateZeusThree(this.game,g,first,this.free,this.zeusThreeBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.zeusThreeBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.spiritRiverContract){const mapped=validateSpiritRiver(this.game,g,first,this.free,this.riverBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.riverBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.ownQuickHitPaidContract){if(first)this.healthyComponentsBase=undefined;const m=validateOwnQuickHitFeatures(this.game,g,first,this.free,this.healthyComponentsBase,this.totalWin);this.totalWin=m.win;this.free=m.free;this.healthyComponentsBase=m.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';
             if(this.game.gameId==='32797'&&['own-quick-hit-client-free-cash-wheel-v6','own-quick-hit-client-paid-cash-wheel-v8'].includes(this.game.sg.ownQuickHitPaidContract.version))assert(this.balance===this.startBalance-this.game.sg.betRaw+this.totalWin,'AG integrity: SG Quick Hit own response balance mismatch');
            }
            else if(this.game.sg.healthyComponentsContract){if(first)this.healthyComponentsBase=undefined;const mapped=validateOwnHealthyComponents(this.game,g,first,this.free,this.healthyComponentsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.healthyComponentsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.eightyFortunesContract){const mapped=validateEightyFortunesData(this.game,g,first,this.free,this.eightyBase,this.totalWin);if(first)this.eightyBase=structuredClone(g);this.totalWin=mapped.win;this.free=mapped.free;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(this.game.sg.coolJewelsFreeContract){const mapped=validateCoolJewelsFreeData(this.game,g,first,this.free,this.coolJewelsBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.coolJewelsBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(first&&this.game.sg.coolJewelsPaidContract){this.totalWin=validateCoolJewelsPaidData(this.game,g);this.action='PLAY';}
            else if(first&&this.game.sg.fireQueenPaidContract){this.totalWin=validateFireQueenPaidData(this.game,g);this.action='PLAY';}
            else if(first&&(this.game.sg.desertCatsContract||this.game.sg.jinjiEndlessContract)){this.totalWin=validateHealthyPaidData(this.game,g);this.action='PLAY';}
            else if(this.game.sg.fudaFreeContract){const mapped=validateFudaOwnFreeData(this.game,g,first,this.free,this.fudaBase,this.totalWin);this.totalWin=mapped.win;this.free=mapped.free;this.fudaBase=mapped.base;this.action=this.free?.freeSpinsRemaining>0?'FREE_SPIN':'PLAY';}
            else if(first&&(this.game.sg.fudaPaidContract||this.game.sg.heidiPaidContract)){this.totalWin=validateOwnRequestVariantData(this.game,g);this.action='PLAY';}
            else {
            assert(g&&(g.BGInfo||g.FSInfo||(this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6')),'AG integrity: SG game result');
            const known=new Set(['stake','stakePerLine','paylineCount','totalWin','betID','ReelResults','BGInfo','FSInfo','BaseGameRecoveryInfo',...(this.game.sg.goldenChiefPaidContract?['PaylineCountInfo','SymbolUpgrade','WildExpansion',...(this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'?['BonusWheel','GambleInfo','CanyonBonus','TotemBonus']:[])]:[]),...(this.game.sg.passiveResultFields || []),...(this.game.sg.wildPositionContract ? ['WildInfo'] : []),...(this.game.sg.compassContract ? ['Compass'] : [])]);
            if(this.game.gameId!=='32763')assert(Object.keys(g).every(k=>known.has(k)),'AG integrity: SG observed feature needs mapping');
            const ownGoldenFree=!first&&this.action==='FREE_SPIN'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.FSInfo!==undefined;
            const goldenWin=ownGoldenFree?validateGoldenChiefFree(this.game,g,this.free,this.goldenPending,this.lastBase,this.totalWin):undefined;
            const passiveTotem=first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.TotemBonus!==undefined;
            if(passiveTotem)validateGoldenChiefTotem(this.game,g);
            const passiveCanyon=first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.CanyonBonus!==undefined;
            if(passiveCanyon)validateGoldenChiefCanyon(this.game,g);
            const pendingGolden=!passiveTotem&&!passiveCanyon&&first&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6'&&g.BonusWheel!==undefined?validateGoldenChiefGambleIntro(this.game,g):undefined;
            const confirmedGolden=!first&&this.action==='PICK_FREE_SPINS'&&this.game.sg.goldenChiefPaidContract==='golden-chief-own-totem-v6';
            if(confirmedGolden){assert(this.goldenPending,'AG integrity: SG Golden Chief pending collect missing');validateGoldenChiefCollectConfirmation(this.game,g,this.goldenPending,this.lastBase);}
            if(this.game.sg.goldenChiefPaidContract&&pendingGolden===undefined&&!confirmedGolden&&!passiveTotem&&!passiveCanyon&&!ownGoldenFree)validateGoldenChiefPaidData(this.game,g);
            if(g.WildInfo !== undefined)validateDragonWildInfo(this.game,g);
            if(g.Compass !== undefined)validateHimalayaCompass(this.game,g,this.free);
            assert(integer(g.stake,'stake')===this.game.sg.betRaw,'AG integrity: SG changed stake');
            const bg=(confirmedGolden||ownGoldenFree)?g.BaseGameRecoveryInfo.BGInfo:g.BGInfo;
            if(this.game.sg.omitsBaseRemaining)assert(bg.baseGameSpinsRemaining===undefined,'AG integrity: SG changed base schema');
            else assert(integer(bg.baseGameSpinsRemaining,'remaining base spins')===0,'AG integrity: SG remaining base action not mapped');
            if(g.BonusData)assert(g.BonusData.BonusBet==='0'&&Object.keys(g.BonusData).length===1,'AG integrity: SG purchased bonus not mapped');
            this.totalWin=goldenWin??integer(bg.totalWagerWin,'cumulative wager win');
            if(!confirmedGolden)assert(g.ReelResults && list(g.ReelResults.ReelSpin).length>0,'AG integrity: SG reel result');
            if(first)this.lastBase=structuredClone(g.ReelResults);
            if(g.BaseGameRecoveryInfo) {
                assert(this.lastBase && JSON.stringify(g.BaseGameRecoveryInfo.ReelResults)===JSON.stringify(this.lastBase),'AG integrity: SG base recovery changed');
            }
            if(passiveTotem||passiveCanyon){this.action='FEATURE';}
            else if(pendingGolden!==undefined){this.goldenPending={count:pendingGolden,stop:g.BonusWheel.stopPosition,baseWin:integer(bg.bgWinnings,'Golden Chief pending base')};this.free={freeSpinsTotal:pendingGolden,freeSpinsPlayed:0,freeSpinsRemaining:pendingGolden,accumulativeWin:this.totalWin/100};this.action='PICK_FREE_SPINS';}
            else if(confirmedGolden){assert(this.free?.freeSpinsTotal===this.goldenPending!.count&&this.free.freeSpinsPlayed===0,'AG integrity: SG Golden Chief confirmed free budget');this.action='FREE_SPIN';}
            else if(g.FSInfo) {
                const f=g.FSInfo,total=integer(f.freeSpinsTotal,'free total'),played=integer(f.freeSpinNumber,'free played');
                assert(played<=total,'AG integrity: SG free counter');
                const freeWin=integer(f.fsWinnings,'free winnings'),baseWin=integer(bg.bgWinnings,'base winnings');
                assert(baseWin+freeWin===this.totalWin,'AG integrity: SG component winnings');
                if(this.free)assert(played>this.free.freeSpinsPlayed && total>=this.free.freeSpinsTotal,'AG integrity: SG nonadvancing free state');
                this.free={freeSpinsTotal:total,freeSpinsPlayed:played,freeSpinsRemaining:total-played,accumulativeWin:this.totalWin/100};
                this.action=played<total?'FREE_SPIN':'PLAY';
            } else {
                assert(!this.free,'AG integrity: SG free state disappeared');
                assert(list(g.ReelResults.ReelSpin).every(s=>s.freeSpin==='N'&&s.bonusAwarded==='N'),'AG integrity: SG unclassified feature');
                this.action='PLAY';
            }
            }
        }
        // AG retains every response in its own action sequence. Do not embed the
        // entire growing SG prefix in each intermediate response (quadratic BSON).
        // The terminal response still provides every exact SG request/response for playback.
        const playbackSteps = this.action==='SPIN' ? this.steps : this.steps.slice(-1);
        return {NextActionInfo:{nextAction:this.action},PlayerBalanceInfo:{preWagerBalance:this.startBalance/100,balance:this.balance/100,wager:this.game.sg.betRaw/100,resultAmount:this.totalWin/100},
            ...(this.free?{FreeSpinsInfo:structuredClone(this.free)}:{}),SGWireResponse:step.responsePayload,
            // Data-only SG playback mapping. AG keeps all of its round/validation/storage fields.
            capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
            startBalance:this.startBalance/100,endBalance:this.balance/100,totalWin:this.totalWin/100,
            stepCount:playbackSteps.length,msgIds:playbackSteps.map(step=>step.msgId),steps:structuredClone(playbackSteps),
            money:{startBalanceRaw:this.startBalance,endBalanceRaw:this.balance,betRaw:this.game.sg.betRaw,totalWinRaw:this.totalWin}};
    }
    close() {
        own32761ProtocolSlots.get(this)?.connection.seal(new Error('Original own32761 SG session closed'));
own32760ProtocolSlots.get(this)?.connection.seal(new Error('Original own32760 SG session closed'));
        own32756ProtocolSlots.get(this)?.connection.seal(new Error('Original own32756 SG session closed'));
        own32763ProtocolSlots.get(this)?.connection.seal(new Error('Original own32763 SG session closed'));
        const own32816Slot=own32816WireSlots.get(this);
        if(own32816Slot){own32816Slot.lifecycle?.close();own32816Slot.binding?.originalOwnerHooks.seal(new Error('Original session closed'));own32816Slot.wire.ownerHooks.seal(new Error('Original session closed'));own32816Slot.host?.timers.clear();}
        const own32806Slot=own32806WireSlots.get(this);
        if(own32806Slot){own32806Slot.lifecycle?.close();own32806Slot.binding?.originalOwnerHooks.seal(new Error('Original session closed'));own32806Slot.wire.ownerHooks.seal(new Error('Original session closed'));own32806Slot.host?.timers.clear();}
        if(this.game.gameId==='32750') {
            const slot=own32750Slots.get(this),failures:unknown[]=[];
            this.closed=true;this.cookies.clear();
            try{slot?.ownerHooks?.seal(slot.error||new Error('own32750 original SG session closed'));}
            catch(error){failures.push(error);}
            const descriptor=this.journal;this.journal=null;
            if(descriptor!==null){try{fs.fsyncSync(descriptor);}catch(error){failures.push(error);}
                finally{try{fs.closeSync(descriptor);}catch(error){failures.push(error);}}}
            if(failures.length)throw Object.assign(own32750Integrity(failures[0]),{cleanupErrors:failures});
            return;
        }
        if (this.game.gameId === '32777') {
            const failures: unknown[] = [];
            this.closed = true;
            this.cookies.clear();
            const nativeFailure = own32777RevokeNativeScope(this);
            if (nativeFailure) failures.push(nativeFailure);
            const descriptor = this.journal;
            this.journal = null;
            if (descriptor !== null) {
                try { fs.fsyncSync(descriptor); }
                catch (error) { failures.push(error); }
                finally {
                    try { fs.closeSync(descriptor); }
                    catch (error) { failures.push(error); }
                }
            }
            if (failures.length) {
                const error = failures.length === 1 ? failures[0] :
                    Object.assign(new Error('own32777 cleanup failures'), {errors:failures});
                own32777NativeCleanupFailure.set(this,error);
                throw error;
            }
            return;
        }

        if(this.game.gameId !== '32769') {
            own32769PendingInit.delete(this);
            own32769ValidatedInit.delete(this);
            own32769ConsumedInitData.delete(this);
            if(this.closed)return;
            this.closed=true;
            this.cookies.clear();
            if(this.journal!==null) {
                fs.fsyncSync(this.journal);
                fs.closeSync(this.journal);
                this.journal=null;
            }
            return;
        }
        const failures: unknown[] = [];
        try {
            own32769NativeBridges.get(this)?.close();
        } catch (error) {
            failures.push(error);
        } finally {
            // Revocation cannot depend on native disposer success.
            own32769NativeBridges.delete(this);
            own32769NativeCurrentFrame.delete(this);
            own32769PendingInit.delete(this);
            own32769ValidatedInit.delete(this);
            own32769ConsumedInitData.delete(this);
            this.closed=true;
            this.cookies.clear();
            const descriptor=this.journal;
            this.journal=null;
            if(descriptor!==null) {
                try { fs.fsyncSync(descriptor); }
                catch(error) { failures.push(error); }
                finally {
                    try { fs.closeSync(descriptor); }
                    catch(error) { failures.push(error); }
                }
            }
        }
        if(failures.length) {
            const failure=failures.length===1 ? failures[0] :
                Object.assign(new Error('own32769 cleanup failures'),{errors:failures});
            own32769NativeCleanupFailure.set(this,failure);
            throw failure;
        }
    }
}


// Own original-UFL source DATA; unchanged leaf functions scoped to avoid
// shadowing unrelated provider helper names. No SG handling code imported.
namespace OwnOriginalUFLData {

export type OwnOriginalUFLRequest = {event:string;parameters:Record<string,string>};
export type OwnOriginalUFLProfile = {gameId:string;dbName:string;runtimeGameId:number;runtimeSlug:string;ownSDKFileSHA256:string;SDKFinalGetterSourceSHA256:string;paidRequestParams:Record<string,string>;freeRequestParams:Record<string,string>;betRaw:number;freeModes:number[];pickerMode:number|null;pickRound:number|null;sourceChoiceDomain:number[];explicitChoice:number|null;sourceEvidenceSHA256:string};
export type OwnOriginalUFLState = {next?:OwnOriginalUFLRequest;activeFree:Record<string,{remaining:number;intro:boolean}>;picker:'inactive'|'start'|'pick'|'end';sentFreeMode?:number;closed:boolean;country?:any};
export function createOwnOriginalUFLState():OwnOriginalUFLState {return{activeFree:{},picker:'inactive',closed:false};}
export function beginOwnOriginalUFLRound(s:OwnOriginalUFLState):void {assert(!s.next&&!s.closed,'AG integrity: own original UFL previous round pending');s.activeFree={};s.picker='inactive';s.sentFreeMode=undefined;s.country=undefined;}
function integer(v:string|undefined,label:string,optionalDefault?:number):number {if(v===undefined&&optionalDefault!==undefined)return optionalDefault;assert(typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),'AG integrity: own original UFL '+label);return Number(v);}
function bool(v:string|undefined,label:string):boolean {if(v===undefined)return false;assert(['0','1','false','true'].includes(v),'AG integrity: own original UFL '+label);return v==='1'||v==='true';}
function ownModeIds(p:OwnOriginalUFLProfile,w:Record<string,string>):number[] {if(w.FID===undefined)return[];const pieces=w.FID.split('|').filter(Boolean);assert(pieces.length>0&&pieces.length<=2,'AG integrity: own original UFL actual FID');const ids=pieces.map(v=>integer(v,'FID'));assert(ids.every(v=>p.freeModes.includes(v)||v===p.pickerMode),'AG integrity: own original UFL actual next mode unmapped');return ids;}
function request(p:OwnOriginalUFLProfile,event:string,extra:Record<string,string>={}):OwnOriginalUFLRequest {return{event,parameters:event==='FREE_GAME'?{...p.freeRequestParams}:{GN:p.runtimeSlug,REC:'0',CFG:String(p.pickerMode),...extra}};}
function select(p:OwnOriginalUFLProfile,s:OwnOriginalUFLState):OwnOriginalUFLRequest|undefined {
 // The own source creates the Fire Link free branch before its picker and
 // keeps the ordinary free branch last. Country has two free branches only.
 const special=p.freeModes[0],a=s.activeFree[String(special)];
 if(a&&(a.intro||a.remaining>0)){s.sentFreeMode=special;return request(p,'FREE_GAME');}
 if(s.picker==='start')return request(p,'FEATURE_START');
 if(s.picker==='pick'){assert(p.pickRound!==null&&p.explicitChoice!==null&&p.sourceChoiceDomain.includes(p.explicitChoice),'AG integrity: own original UFL source choice absent');return request(p,'FEATURE_PICK',{FP:`${p.pickRound}|1|${p.explicitChoice}`});}
 if(s.picker==='end')return request(p,'FEATURE_END');
 for(const mode of p.freeModes.slice(1)){const q=s.activeFree[String(mode)];if(q&&(q.intro||q.remaining>0)){s.sentFreeMode=mode;return request(p,'FREE_GAME');}}
 s.sentFreeMode=undefined;return undefined;
}
export function getOwnOriginalUFLNext(s:OwnOriginalUFLState):OwnOriginalUFLRequest|undefined {return s.next?structuredClone(s.next):undefined;}
export function updateOwnOriginalUFLNext(p:OwnOriginalUFLProfile,s:OwnOriginalUFLState,event:string,w:Record<string,string>):void {
 assert(!s.closed,'AG integrity: own original UFL state closed');
 if(event!=='BET')assert(s.next?.event===event,'AG integrity: own original UFL response order');
 assert(['BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event),'AG integrity: own original UFL event unmapped');
 if(p.gameId==='32743'){
  assert(event==='BET'||event==='FREE_GAME','AG integrity: own Country network event unmapped');
  const signed=(value:string|undefined,label:string)=>{if(value===undefined)return undefined;assert(/^-?\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'AG integrity: own Country '+label);return Number(value);};
  const decoded:any={NFG:signed(w.NFG,'NFG'),TFG:signed(w.TFG,'TFG'),GCT:bool(w.GCT,'GCT'),FID:ownModeIds(p,w)};
  if(w.GSD!==undefined){const field=w.GSD.split('#').find(v=>v.startsWith('flBonus~'));if(field!==undefined){const value=JSON.parse(field.slice('flBonus~'.length));assert(value&&value.fireballs!==null&&typeof value.fireballs==='object','AG integrity: own Country Link fireballs');decoded.linkCellCount=0;for(const key in value.fireballs){if(!Number.isNaN(Number.parseInt(key,10)))decoded.linkCellCount+=1;}}}
  const result=selectCountryNext(s.country,decoded);s.country=result.state;s.next=result.next?request(p,result.next):undefined;return;
 }
 const cap=bool(w.GCT,'GCT'),remaining=integer(w.NFG,'NFG',0),ids=ownModeIds(p,w);
 if(cap){s.activeFree={};s.picker='inactive';s.next=undefined;return;}
 if(event==='FEATURE_START'){
  // Own successful start callers set GZ/I3=true locally, then enter picker.
  // FS_n and FPM_n are recovery metadata; they are not fresh-session gates.
  assert(p.pickerMode!==null&&s.picker==='start','AG integrity: own original UFL source start scope');s.picker='pick';
 }else if(event==='FEATURE_PICK'){
  assert(p.pickerMode!==null&&s.picker==='pick','AG integrity: own original UFL source pick scope');s.picker='end';
 }else if(event==='FEATURE_END'){
  assert(p.pickerMode!==null&&s.picker==='end','AG integrity: own original UFL source end scope');
  // Own FEATURE_END response clears the old game model before restoring its
  // actual ordinary free counter. No stale outer round is synthesized.
  s.activeFree={};s.picker='inactive';
  if(remaining>0)s.activeFree[String(p.freeModes[p.freeModes.length-1])]={remaining,intro:false};
 }else{
  for(const mode of ids){
   if(mode===p.pickerMode){if(s.picker==='inactive')s.picker='start';}
   else if(!s.activeFree[String(mode)])s.activeFree[String(mode)]={remaining:0,intro:event==='BET'||mode!==s.sentFreeMode};
  }
  const ownCurrent=ids.length&&p.freeModes.includes(ids[0])?ids[0]:event==='FREE_GAME'?s.sentFreeMode:undefined;
  if(ownCurrent!==undefined){const q=s.activeFree[String(ownCurrent)]||(s.activeFree[String(ownCurrent)]={remaining:0,intro:false});q.remaining=remaining;if(event==='FREE_GAME'&&s.sentFreeMode===ownCurrent)q.intro=false;if(event==='FREE_GAME'&&q.remaining===0&&!q.intro)delete s.activeFree[String(ownCurrent)];}
  else if(remaining>0){assert(event==='BET'&&ids.length===0,'AG integrity: own original UFL counter target unmapped');s.activeFree[String(p.freeModes[p.freeModes.length-1])]={remaining,intro:false};}
 }
 s.next=select(p,s);
}



// Isolated protocol DATA proposal. Not installed in any live program.
// Fixed own SDK: 9cf163fe2b584bd14b7b2ab2c7bdd0f590d94637cc110e54376c8a0d0dbfa79a.
// Inputs are already decoded fields, after the existing successful-envelope guard.
// This module neither sends requests nor synthesizes response packets.

function initialCountryState() {
  // Own Da.Gb / Da.Xb clear + G.ba.Da.Xb clear.
  return {
    dc: { pending: false, remaining: null, linkCellCount: 0 },
    tb: { pending: false, remaining: null, total: 0 },
  };
}

function countField(value, fallback, name) {
  if (value === undefined) return fallback; // Only own explicit SDK defaults.
  if (!Number.isSafeInteger(value)) throw new Error(`SG own Country invalid ${name}`);
  return value;
}

function selectCountryNext(previous, decoded) {
  const prior = previous || initialCountryState();
  const state = { dc: { ...prior.dc }, tb: { ...prior.tb } };
  const nfg = countField(decoded.NFG, 0, 'NFG');
  const tfg = countField(decoded.TFG, 0, 'TFG');
  const gct = decoded.GCT === undefined ? false : decoded.GCT;
  if (typeof gct !== 'boolean') throw new Error('SG own Country invalid GCT');
  const ids = decoded.FID === undefined ? [] : decoded.FID;
  if (!Array.isArray(ids) || ids.length > 2 || ids.some(id => id !== 0 && id !== 1)) {
    throw new Error('SG own Country unmapped actual FID');
  }

  // Own Mi invokes kCa for only the first two FID entries.
  for (const id of ids) {
    if (id === 0) state.dc.pending = true;
    if (id === 1) {
      state.tb.pending = true;
      state.tb.total = tfg;
    }
  }

  // Exact Q7a target: dc.rs && (FID[0] == 0 || io) ? dc : tb.
  // G.ba.Da.Xb.clear only clears this target; jCa then binds its Lj = NFG.
  // The other stage's counter survives a response for the current stage.
  const target = state.dc.pending && (ids[0] === 0 || gct) ? 'dc' : 'tb';
  state[target].remaining = nfg;

  // Optional own flBonus.fireballs count is a real next/end input:
  // JN.Gb.$da tests 40 == dc.ye.length. It is not a display equation.
  // The caller may derive this from its own decoded GSD; no cash values needed.
  if (decoded.linkCellCount !== undefined) {
    if (!Number.isSafeInteger(decoded.linkCellCount) || decoded.linkCellCount < 0) {
      throw new Error('SG own Country invalid Link cell count');
    }
    state.dc.linkCellCount = decoded.linkCellCount;
  }

  // Keep the existing original-AG GCT cap handling. Do not request after cap.
  if (gct) return { state, next: null, end: true, reason: 'own-GCT-cap' };

  // Exact own Link controller continuation/removal conditions. CZa selects AZa,
  // whose fixed messageType is FREE_GAME; there is no own FEATURE_PICK caller.
  if (state.dc.pending) {
    const outerReady = state.tb.pending && state.tb.remaining > 0;
    const linkClosed = state.dc.remaining === 0 || state.dc.linkCellCount === 40 || outerReady;
    if (!linkClosed) {
      if (state.dc.remaining === null) throw new Error('SG own Country Link remaining unresolved');
      return { state, next: 'FREE_GAME', end: false, reason: 'own-CZa-AZa' };
    }
    // Source JN.Gb clears dc before joining the outer tb feature flow.
    state.dc.pending = false;
    state.dc.remaining = null;
    state.dc.linkCellCount = 0;
  }

  if (state.tb.remaining > 0) {
    // Own normal active-free yfa -> k_a -> i_a -> FREE_GAME.
    return { state, next: 'FREE_GAME', end: false, reason: 'own-k_a-i_a' };
  }
  if (state.tb.pending && state.tb.remaining === null) {
    // New combined flow has no actual outer-stage count yet. Preserve the state;
    // don't borrow another game's counter or manufacture an end packet.
    throw new Error('SG own Country outer Free remaining unresolved');
  }
  if (state.tb.remaining < 0) {
    throw new Error('SG own Country unmapped actual negative Free remaining');
  }
  state.tb.pending = false;
  return { state, next: null, end: true, reason: 'own-all-next-counters-closed' };
}




const ownProfiles:OwnOriginalUFLProfile[]=[{"gameId":"32687","dbName":"sg_uflchinastreet","runtimeGameId":33096,"runtimeSlug":"uflchinastreet","ownSDKFileSHA256":"382ed58bb4745e4921f0f35346e30113bcc3ae423ace387d99c7396f07119bf6","SDKFinalGetterSourceSHA256":"38c3d5f2e9882458e52b34be4cd82e5b8d47cef4261d0b2b0eb76c5ea50baf41","paidRequestParams":{"BPL":"5","GN":"uflchinastreet","LB":"50","REC":"0"},"freeRequestParams":{"BPL":"5","GN":"uflchinastreet","LB":"50","REC":"0"},"betRaw":100,"freeModes":[0,2],"pickerMode":1,"pickRound":0,"sourceChoiceDomain":[0,1,2,3,4,5],"explicitChoice":1,"sourceEvidenceSHA256":"3f8d7c45db545662f98edd884bcbb26b1ebb49678ec7648b729b3d503c799f85"},{"gameId":"32743","dbName":"sg_ultimatefirelinkcountrylights96","runtimeGameId":33143,"runtimeSlug":"ultimatefirelinkcountrylights96","ownSDKFileSHA256":"9cf163fe2b584bd14b7b2ab2c7bdd0f590d94637cc110e54376c8a0d0dbfa79a","SDKFinalGetterSourceSHA256":"5e7fabb58cd844b87b12cd202785333c1f818f9261e684b4c7ee3d853807dd57","paidRequestParams":{"BPL":"5","GN":"ultimatefirelinkcountrylights96","LB":"150","REC":"0"},"freeRequestParams":{"BPL":"5","GN":"ultimatefirelinkcountrylights96","LB":"150","REC":"0"},"betRaw":100,"freeModes":[0,1],"pickerMode":null,"pickRound":null,"sourceChoiceDomain":[],"explicitChoice":null,"sourceEvidenceSHA256":"2462270f75a6af6b5feaa642c364acfd9f48619f3796b5e89653191bbc9c472a"},{"gameId":"32744","dbName":"sg_uflriverwalk96","runtimeGameId":33144,"runtimeSlug":"uflriverwalk96","ownSDKFileSHA256":"b834eb56aef577215e64256513015828624440c8f26cde80b1fd1deac36ec070","SDKFinalGetterSourceSHA256":"f9fde762db7df4461f3766065a56f6bb5d9a251a322c3a47f3542521bac7393c","paidRequestParams":{"BPL":"5","GN":"uflriverwalk96","LB":"50","REC":"0"},"freeRequestParams":{"BPL":"5","GN":"uflriverwalk96","LB":"50","REC":"0"},"betRaw":100,"freeModes":[1,0],"pickerMode":2,"pickRound":1,"sourceChoiceDomain":[0,1,2,3,4,5],"explicitChoice":1,"sourceEvidenceSHA256":"e9603707ffd057dd865c002dd9cdf40c420e462beefd9985f3a0991fbb3ddc5b"}];
export function ownOriginalUFLSourceProfile(game:any):OwnOriginalUFLProfile|undefined {
 const c=game.sg?.ownGDMContract,q=c?.ownRootNFGFlowOnlyCapture,b=q?.ownOriginalUFLSourceFlow;if(!b)return undefined;
 const p=ownProfiles.find(v=>v.gameId===game.gameId);assert(p&&game.provider==='sg'&&game.dbName===p.dbName&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&c.ownSDKFileSHA256===p.ownSDKFileSHA256&&c.SDKFinalGetterSourceSHA256===p.SDKFinalGetterSourceSHA256&&c.betRaw===p.betRaw&&game.sg.betRaw===p.betRaw,'AG integrity: own original UFL source identity');
 assert.deepStrictEqual(b,p,'AG integrity: own original UFL source input binding');assert.deepStrictEqual(game.sg.requestParams,p.paidRequestParams);assert.deepStrictEqual(c.freeBudgetContract.freeRequestParams,p.freeRequestParams);return p;
}

}
export const ownOriginalUFLSourceProfile=OwnOriginalUFLData.ownOriginalUFLSourceProfile;
export const createOwnOriginalUFLState=OwnOriginalUFLData.createOwnOriginalUFLState;
export const beginOwnOriginalUFLRound=OwnOriginalUFLData.beginOwnOriginalUFLRound;
export const getOwnOriginalUFLNext=OwnOriginalUFLData.getOwnOriginalUFLNext;
export const updateOwnOriginalUFLNext=OwnOriginalUFLData.updateOwnOriginalUFLNext;

// SG GDM connection/protocol DATA provider for the unchanged original AG.
// No legacy SG imports, transport retries, source-result guesses or SG storage.

const OWN_SAMURAI_CI_EXPECTED_BINDING={"version":"own-SamuraiStorm-CI-source-next-end-v91","gameId":"32671","dbName":"sg_thunderdrumssamuraistorm96","runtimeGameId":33091,"runtimeSlug":"thunderdrumssamuraistorm96","ownSDKFileSHA256":"9f52bade9da5a47a71e0c8035383d7e801da187bb54c15fc2af4355ed87fbf7c","ownIndexSHA256":"c1b000d1a689ce15b63f7b136b03cd68b5fc9a4a2c778b5f2e6ab70569b1f7ac","sourceHashes":{"inheritedRequests":"f657e272eca765757ff34c4e89fb03b3a4926702fd1b0acf0f4e2c577d330700","ownPaidRequest":"af3d666d3a8a906f72377915357ff509e7cecfd1e1577bcf8e2cac9808bf19f9","ownPickRequest":"1c35f4b15b11f7f9e197c947e069b89bedcb730c2013751d91be7d5fe3efe72d","ownBETFeatureEntry":"f8d2384455d176a3e64e1963aea492c1447b8066746856788ddbb45a9f0212ee","ownStake":"c4c85bfeabf29fe10692c64f1a9fb03a30a72f0fcaf9c8dc7f7c70a5f95ca6f7","ownPostPickAndEnd":"43f97e091e1ad20ebdb8e46200df8a8f6cd40ac3770cbbab1a2970a9bace1454","ownAckPickDecoder":"88ee628db65f39e98cd00e2a6ce9e608f873a7ce30b4a7159d9cd4867fc0f87a","ownFreeTerminal":"eb225ed4e6f87dcb2b4b7173ab0baa74bd4d57e18cb043a5ab28d49821e2bfc5","ownFreeCaller":"9ada5cbd6dd56106db5b026e21ad092754d7d6a6d477614d1ba6ae6639ce2793","ownPickCaller":"04f86d145e8ef03bd32a3ca32eb465b07674ebdbd98cf0ef51be6ebed27a8c46","ownInterpreterRegistration":"0ea2d4cd2fb5a8f14fb4a860a044efac73de59589301c7178df639a1a7860bb4","ownOuterFreeStack":"1900fbc55a50f0f061748b24699a0abfedb92b2912298efb7ef401b9bcef6e98","ownDrumConstruction":"7714c41169c50905460aa77cf45562a0f1ed1edae13c0f8ccab0a117e0214cd7","ownPickNetworkCallback":"9951843c0ec45120ef8f4970da6053c4b532ce9921a8c73eb872ea4327a3594e","ownConsumedChoiceDisabled":"4ef025d0ef03c5c7c0132d61cada0357e1fb62c5b1f4e0fbf272e3fbf9c47c71","ownActiveFactory":"e921e6aab543ba6409d165d7c5e93618eadd92e7e8a906ebc38417378e83cf8d","ownInitialWalletSource":"ee45bcb64e1c5f381b5e8c678e35b303ec536e70779790354c0d1b008077e3b3","ownBETWalletSource":"6a940727d5bc926c5585e643becc918ad712470b37e481eadb3bb4239966b57d"},"ownSixLegacySourceSHA256s":["edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789","edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789","edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789","edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789","edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789","edb05423f2f9821b33295faf8c656fbcc7ecc26ae6834686883002efbf6ad789"],"paidRequestParams":{"GN":"thunderdrumssamuraistorm96","BPL":"5","LB":"25","ABPM":"0"},"freeRequestParams":{"GN":"thunderdrumssamuraistorm96","BPL":"5","LB":"25","ABPM":"0"},"betRaw":100,"ownStakeFormula":"20*BPL+BPL*ABPM","walletWireKey":"AB","walletSourceIsOwnInitAndEachResponseSameAccount":true,"cashResultUsesActualWalletDeltaForSinglePaidBETOnly":true,"allFeatureAndFreeFollowupsHaveNoNewPaidBET":true,"TW_CW_B_ABRawUnmodified":true,"ownCFG":"1","ownChoiceIndices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"sourceAckPickCountAndUsedIDsOnly":true,"pickFPHasTrailingDelimiter":false,"startEvent":"FEATURE_START","pickEvent":"FEATURE_PICK","endEvent":"FEATURE_END","freeEvent":"FREE_GAME","currentJackpotAwardedNonemptySelectsEnd":true,"ownGCTTrueOr1SelectsFreeTerminal":true,"ownPriorFreeStateRestoredAfterFeature":true,"rawWirePreserved":true,"noSyntheticNFGOrTerminal":true,"oldUnknownPOSTNeverReplayed":true,"automaticUnknownResetOFF":true,"originalAGAmountReplayMongoChecksRequired":true,"naturalProviderFreeOrFeatureACKCoverage":0,"freeBeforeQueuedPickWithoutCFG":true};
// Own CI source selectors only. No provider-response or terminal fabrication.
export type OwnSamuraiCIProfile={gameId:string;runtimeSlug:string;cfg:number;betRaw:number};
export type OwnSamuraiCIRequest={event:string;parameters:Record<string,string>};
export type OwnSamuraiCIState={phase:'base'|'free'|'start'|'pick'|'end';next?:OwnSamuraiCIRequest;
 freeRemaining?:number;resumeFree:boolean;ackPickCount:number;used:Set<number>};
function ownCIInteger(value:string|undefined,label:string):number {
 assert(typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)&&Number.isSafeInteger(Number(value)),
  'AG integrity: Samurai CI '+label);return Number(value);
}
function ownCIWalletInteger(value:string|undefined,label:string):number {
 assert(typeof value==='string'&&value.trim()!=='','AG integrity: Samurai CI '+label);
 const amount=Number(value);
 assert(Number.isSafeInteger(amount)&&amount>=0,'AG integrity: Samurai CI '+label);
 return amount;
}
export function ownSamuraiCIProfile(game:any):OwnSamuraiCIProfile|undefined {
 const c=game.sg?.ownGDMContract,q=c?.ownRootNFGFlowOnlyCapture,b=q?.ownSamuraiCIFlow;
 if(!b)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32671'&&game.dbName==='sg_thunderdrumssamuraistorm96'
  &&game.backendId==='thunderdrumssamuraistorm96'&&game.sg.runtimeGameId===33091
  &&game.sg.runtimeSlug==='thunderdrumssamuraistorm96'&&game.sg.betRaw===100&&c.betRaw===100
  &&c.ownSDKFileSHA256==='9f52bade9da5a47a71e0c8035383d7e801da187bb54c15fc2af4355ed87fbf7c'
  &&q.version==='own-CI-SamuraiStorm-next-end-flow-v90','AG integrity: Samurai CI own identity');
 assert.deepStrictEqual(b,OWN_SAMURAI_CI_EXPECTED_BINDING,'AG integrity: Samurai CI own source binding');
 assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: Samurai CI paid request');
 assert.deepStrictEqual(c.freeBudgetContract.freeRequestParams,b.freeRequestParams,'AG integrity: Samurai CI free request');
 return {gameId:'32671',runtimeSlug:'thunderdrumssamuraistorm96',cfg:1,betRaw:100};
}
export function createOwnSamuraiCIState():OwnSamuraiCIState {
 return {phase:'base',resumeFree:false,ackPickCount:0,used:new Set()};
}
export function beginOwnSamuraiCIRound(s:OwnSamuraiCIState):void {
 assert(!s.next,'AG integrity: Samurai CI previous round pending');
 s.phase='base';s.freeRemaining=undefined;s.resumeFree=false;s.ackPickCount=0;s.used.clear();
}
function ownCIRequest(p:OwnSamuraiCIProfile,event:string,extra:Record<string,string>={}):OwnSamuraiCIRequest {
 return {event,parameters:{GN:p.runtimeSlug,...(event==='FREE_GAME'?{}:{CFG:String(p.cfg)}),...extra}};
}
function ownCIPick(p:OwnSamuraiCIProfile,s:OwnSamuraiCIState):OwnSamuraiCIRequest {
 const choice=Array.from({length:16},(_,i)=>i).find(i=>!s.used.has(i));
 assert(choice!==undefined,'AG integrity: Samurai CI no source-enabled choice');
 return ownCIRequest(p,'FEATURE_PICK',{FP:`${s.ackPickCount+1}|1|${choice}`});
}
function ownCINormal(p:OwnSamuraiCIProfile,s:OwnSamuraiCIState,event:string,wire:Record<string,string>):void {
 // Source translateBETResponse sends FEATURE_START before returning its
 // feature/free state; do not replace that actual network call by UI flags.
 const cap=event==='FREE_GAME'&&(wire.GCT==='true'||wire.GCT==='1');
 if(wire.FID!==undefined){const ids=wire.FID.split('|').filter(v=>v!=='');
  assert(ids.length>0&&ids.every(v=>v==='0'||v==='1'),'AG integrity: Samurai CI actual feature identity unmapped');}
 if(wire.NFG!==undefined)s.freeRemaining=ownCIInteger(wire.NFG,'actual NFG');
 else if(event==='BET')s.freeRemaining=undefined;
 if(cap)s.freeRemaining=undefined;
 const rawCFG=wire.CFG;
 let start=false;
 if(rawCFG!==undefined&&rawCFG!==''){
  const cfg=ownCIInteger(rawCFG,'actual CFG');
  assert(cfg===p.cfg,'AG integrity: Samurai CI actual feature CFG unmapped');
  const fs=wire['FS_'+rawCFG];start=fs===undefined||ownCIInteger(fs,'actual FS')===0;
 }
 const fallback=wire.FID==='0|1|'&&wire.FPM_1==='|'&&wire.RID==='1'&&wire.NRID==='0';
 const intro=(wire.FID==='1|'||wire.FID==='0|1|')&&wire.FPM_1==='|';
 if(start||fallback){
  s.resumeFree=s.freeRemaining!==undefined&&s.freeRemaining>0;
  s.ackPickCount=0;s.used.clear();s.phase='start';s.next=ownCIRequest(p,'FEATURE_START');return;
 }
 // The own client only starts the pick from an actual CFG or its
 // explicit RID1/NRID0 callback. A first-layer free remains active
 // while the following pick lacks CFG; FID presence alone is not a click.
 const firstFeature=wire.FID?.split('|').find(id=>id!=='');
 if((rawCFG===undefined||rawCFG==='')&&firstFeature==='0'&&s.freeRemaining!==undefined&&s.freeRemaining>0){
  s.phase='free';s.next=ownCIRequest(p,'FREE_GAME');return;
 }
 if(intro){
  assert(rawCFG==='1','AG integrity: Samurai CI active pick has no own actual CFG');
  s.resumeFree=s.freeRemaining!==undefined&&s.freeRemaining>0;
  s.ackPickCount=0;s.used.clear();s.phase='pick';s.next=ownCIPick(p,s);return;
 }
 if(s.freeRemaining!==undefined&&s.freeRemaining>0){s.phase='free';s.next=ownCIRequest(p,'FREE_GAME');}
 else{s.phase='base';s.next=undefined;}
}
export function updateOwnSamuraiCINext(p:OwnSamuraiCIProfile,s:OwnSamuraiCIState,event:string,wire:Record<string,string>):void {
 if(event==='BET'){assert(!s.next,'AG integrity: Samurai CI pending BET');ownCINormal(p,s,event,wire);return;}
 assert(s.next?.event===event,'AG integrity: Samurai CI actual network event');
 if(event==='FREE_GAME'){ownCINormal(p,s,event,wire);return;}
 if(event==='FEATURE_START'){s.phase='pick';s.next=ownCIPick(p,s);return;}
 if(event==='FEATURE_PICK'){
  const values=gsd(wire.GSD);
  assert(wire.CFG==='1'&&typeof wire.FPM_1==='string'&&typeof values.PICK_RESULT_JACKPOT==='string',
   'AG integrity: Samurai CI own acknowledged picks missing');
  // Exactly the current source decoder's fields, not a guessed local ++.
  const results=values.PICK_RESULT_JACKPOT.split(','),rawIDs=wire.FPM_1.split('|');
  const ids=results.map((_,i)=>{
   assert(rawIDs[i]!==undefined,'AG integrity: Samurai CI acknowledged choice missing');
   const id=ownCIInteger(rawIDs[i].replace(';',''),'actual acknowledged choice');
   assert(id<16,'AG integrity: Samurai CI choice outside actual source grid');return id;
  });
  assert(results.length>0&&results.length<=16&&new Set(ids).size===ids.length,
   'AG integrity: Samurai CI acknowledged choice state');
  s.ackPickCount=results.length;s.used=new Set(ids);
  if(values.JACKPOT_AWARDED!==undefined&&values.JACKPOT_AWARDED!==''){
   s.phase='end';s.next=ownCIRequest(p,'FEATURE_END');
  }else{s.phase='pick';s.next=ownCIPick(p,s);}return;
 }
 assert(event==='FEATURE_END','AG integrity: Samurai CI network action unmapped');
 // Own FEATURE_END restores delayedResponse. Its optional NFG is not the
 // FREE_GAME decoder. Restore only the actual retained outer free state.
 if(s.resumeFree&&s.freeRemaining!==undefined&&s.freeRemaining>0){s.phase='free';s.next=ownCIRequest(p,'FREE_GAME');}
 else{s.phase='base';s.next=undefined;}s.resumeFree=false;
}
export function getOwnSamuraiCINext(s:OwnSamuraiCIState,freeParams:Record<string,string>):OwnSamuraiCIRequest|undefined {
 if(!s.next)return undefined;
 return {event:s.next.event,parameters:s.next.event==='FREE_GAME'?{...freeParams}:{...s.next.parameters}};
}
export function ownSamuraiCIWalletAmount(start:number,betRaw:number,wire:Record<string,string>){
 assert(Number.isSafeInteger(start)&&start>=0&&betRaw===100,'AG integrity: Samurai CI actual paid cash origin');
 const end=ownCIWalletInteger(wire.AB,'actual same-account wallet AB');
 const win=end-start+betRaw;
 assert(Number.isSafeInteger(win)&&win>=0,'AG integrity: Samurai CI original whole cash conservation');
 return {end,win}; // All original B/AB/TW/CW stay untouched in SGWireResponse.
}

const ownUFLFlowProfiles:Record<string,any>={"32686":{"version":"own-UFL-source-current-response-next-end-v1","gameId":"32686","dbName":"sg_uflcashfallsolverastreet96","runtimeGameId":33095,"runtimeSlug":"uflcashfallsolverastreet96","ownSDKFileSHA256":"d57889bb040e2294d1e93d15c93b5512e4cd99e60b9a2dc55e2c2cafd5d4285d","SDKFinalGetterSourceSHA256":"93c086f7ae10dbe025b46d38019ec0c5f715c399eef0a2f918739c305c489c9c","ownPendingMethodSourceSHA256":"0eb188574df140a5d8d164143636f89cb02323a5f3a613721d90b6a049c7eb4d","paidRequestParams":{"AP":"false","BPR":"5","GN":"uflcashfallsolverastreet96","RB":"5"},"freeRequestParams":{"AP":"false","BPR":"5","GN":"uflcashfallsolverastreet96","RB":"5"},"betRaw":100,"ownNextEvent":"FREE_GAME","primaryRemainingWireKey":"NFG","extraFreeCurrentIndexWireKey":"FGCR","extraFreeIntroRemainingWireKey":"FGRT","extraFreeRemainingWireKey":"FGRR","ownTriggerFlagWireKey":"FLRT","ownTriggerFlagTrueValue":1,"ownNextTriggerNumericPresenceWireKey":"FLNTR","numericZeroNextTriggerStillPending":true,"sourceGCTStopsBeforePending":true,"optionalMetadataRawPreserved":true,"noDisplayOrStageMoneyEquations":true,"oldUnknownPOSTNeverReplayed":true,"noSyntheticProviderACKOrTerminal":true},"32740":{"version":"own-UFL-source-current-response-next-end-v1","gameId":"32740","dbName":"sg_uflcashfallsbythebay96","runtimeGameId":33140,"runtimeSlug":"uflcashfallsbythebay96","ownSDKFileSHA256":"f620c08cf1504048592b157a37d220dc798dd60696cd774069c64d3cbb82a16f","SDKFinalGetterSourceSHA256":"5f7c4e5fd999bbaa6149ccab530534469d4ac1a01566650a680eabfe2260ae93","ownPendingMethodSourceSHA256":"ebbfa66836516d914ded1832a602bb7f285d59ccdfda489e0f5e49306704d8c0","paidRequestParams":{"BPR":"10","GN":"uflcashfallsbythebay96","RB":"5"},"freeRequestParams":{"BPR":"10","GN":"uflcashfallsbythebay96","RB":"5"},"betRaw":200,"ownNextEvent":"FREE_GAME","primaryRemainingWireKey":"NFG","extraFreeCurrentIndexWireKey":"FGCR","extraFreeIntroRemainingWireKey":"FGRT","extraFreeRemainingWireKey":"FGRR","ownTriggerFlagWireKey":"FLRT","ownTriggerFlagTrueValue":1,"ownNextTriggerNumericPresenceWireKey":"FLNTR","numericZeroNextTriggerStillPending":true,"sourceGCTStopsBeforePending":true,"optionalMetadataRawPreserved":true,"noDisplayOrStageMoneyEquations":true,"oldUnknownPOSTNeverReplayed":true,"noSyntheticProviderACKOrTerminal":true},"32741":{"version":"own-UFL-source-current-response-next-end-v1","gameId":"32741","dbName":"sg_uflcashfallschinastreet96","runtimeGameId":33141,"runtimeSlug":"uflcashfallschinastreet96","ownSDKFileSHA256":"98178e8b2e2190436b46d784d8ea0bed7655df8ae340f2cb6e602e9093fb4a3a","SDKFinalGetterSourceSHA256":"b824e2371a44e479df3cf13767683c23f660cb859e5ffc137bfa2312c9ad0b25","ownPendingMethodSourceSHA256":"9f6d2ef1c27e436782042f11d616fce1da69ca5a73d1ed830ba2837d5ad79c35","paidRequestParams":{"BPR":"5","GN":"uflcashfallschinastreet96","RB":"5"},"freeRequestParams":{"BPR":"5","GN":"uflcashfallschinastreet96","RB":"5"},"betRaw":100,"ownNextEvent":"FREE_GAME","primaryRemainingWireKey":"NFG","extraFreeCurrentIndexWireKey":"FGCR","extraFreeIntroRemainingWireKey":"FGRT","extraFreeRemainingWireKey":"FGRR","ownTriggerFlagWireKey":"FLRT","ownTriggerFlagTrueValue":1,"ownNextTriggerNumericPresenceWireKey":"FLNTR","numericZeroNextTriggerStillPending":true,"sourceGCTStopsBeforePending":true,"optionalMetadataRawPreserved":true,"noDisplayOrStageMoneyEquations":true,"oldUnknownPOSTNeverReplayed":true,"noSyntheticProviderACKOrTerminal":true},"32742":{"version":"own-UFL-source-current-response-next-end-v1","gameId":"32742","dbName":"sg_uflcashfallsglaciergold96","runtimeGameId":33142,"runtimeSlug":"uflcashfallsglaciergold96","ownSDKFileSHA256":"02e56569f099f43fb81b48cb78d04fb702330901a2005432451ff2f15fba0d25","SDKFinalGetterSourceSHA256":"cfab520cb2c0fc58a4b33e42e924fc67a28413e8b1d18d958d8e03eefd3b12bd","ownPendingMethodSourceSHA256":"e118255b97dea802910780cbc847580b06909db710429ca2f31ba55d92e7ca06","paidRequestParams":{"BPR":"5","GN":"uflcashfallsglaciergold96","RB":"5"},"freeRequestParams":{"BPR":"5","GN":"uflcashfallsglaciergold96","RB":"5"},"betRaw":100,"ownNextEvent":"FREE_GAME","primaryRemainingWireKey":"NFG","extraFreeCurrentIndexWireKey":"FGCR","extraFreeIntroRemainingWireKey":"FGRT","extraFreeRemainingWireKey":"FGRR","ownTriggerFlagWireKey":"FLRT","ownTriggerFlagTrueValue":1,"ownNextTriggerNumericPresenceWireKey":"FLNTR","numericZeroNextTriggerStillPending":true,"sourceGCTStopsBeforePending":true,"optionalMetadataRawPreserved":true,"noDisplayOrStageMoneyEquations":true,"oldUnknownPOSTNeverReplayed":true,"noSyntheticProviderACKOrTerminal":true}};
export function ownUFLSourceProfile(game:any):any|undefined {
 const c=game.sg?.ownGDMContract,q=c?.ownRootNFGFlowOnlyCapture;
 if(q?.version!=='own-UFL-source-next-end-flow-only-v6')return undefined;
 const p=ownUFLFlowProfiles[game.gameId];
 assert(p&&game.dbName===p.dbName&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&c.ownSDKFileSHA256===p.ownSDKFileSHA256&&c.SDKFinalGetterSourceSHA256===p.SDKFinalGetterSourceSHA256&&c.betRaw===p.betRaw,'AG integrity: UFL own flow identity');
 assert.deepStrictEqual(q.ownUFLSourceFlow,p,'AG integrity: UFL own source flow binding');return p;
}
export function ownUFLSourcePending(p:any,wire:Record<string,string>):boolean {
 assert(p&&ownUFLFlowProfiles[p.gameId]===p,'AG integrity: UFL own source selector profile');
 const value=(v:string,k:string)=>{assert(/^(?:0|-?[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),'AG integrity: UFL actual next counter '+k);return Number(v);};
 if(wire.GCT!==undefined){assert(['0','1','false','true'].includes(wire.GCT),'AG integrity: UFL actual terminal flag');if(wire.GCT==='1'||wire.GCT==='true')return false;}
 // Own SDK explicitly defaults missing primary NFG to zero; raw is untouched.
 const n=wire.NFG===undefined?0:value(wire.NFG,'NFG');if(n>0)return true;if(n!==0)return false;
 const data=wire.GSD===undefined?{}:ownGDMFields(wire.GSD,'#','~');
 // Source current-index default chooses FGRT before any free step, else FGRR.
 const first=data.FGCR===undefined||value(data.FGCR,'FGCR')===0,k=first?'FGRT':'FGRR';
 if(data[k]!==undefined&&value(data[k],k)>0)return true;
 if(data.FLRT!==undefined&&value(data.FLRT,'FLRT')===1)return true;
 // Source isNumber/presence predicate, not a >0 counter. Numeric zero is next.
 if(data.FLNTR!==undefined){value(data.FLNTR,'FLNTR');return true;}return false;
}
// Private candidate only. It is not admitted to any production entry.
// Raw responses, successful-envelope checks and original AG money/Mongo remain
// owned by SGGdmSession. No response or terminal ACK is created here.


export type CoinRequest={event:string;parameters:Record<string,string>};
export type CoinProfile={gameId:'32590'|'32729';runtimeSlug:string;cfg:1|2;
  freeRequestParams:Record<string,string>;freeCFGs:number[];inactiveCFGs:number[];
  pickTotal:'own-FTV-first-row-index-one'|'own-GSD-JPS-length'};
export type CoinState={next?:CoinRequest;lastRequested?:CoinRequest;
  freeRemaining?:number;totalPicks?:number;featureActive?:boolean;choices:number[];own32590FTV?:string;own32729Picker?:Own32729PickerState};
export const createCoinState=():CoinState=>({choices:[]});
const ownCoinInteger=(raw:string,label:string)=>{
  assert(raw.trim()!=='','AG integrity: Coin Combo '+label);
  const n=Number(raw);assert(Number.isSafeInteger(n),'AG integrity: Coin Combo '+label);return n;
};
const ownCoinBoolean=(raw:string,label:string)=>{
  const n=Number(raw);if(raw.trim()!==''&&Number.isFinite(n))return n!==0;
  const text=raw.toLowerCase();if(['true','y','yes'].includes(text))return true;
  assert(['false','n','no'].includes(text),'AG integrity: Coin Combo '+label);return false;
};
const ownCoinVector=(raw:string,separator:string,strategy:'infix'|'postfix',label:string)=>{
  const values=raw.split(separator);if(strategy==='postfix')values.pop();
  return values.map(v=>ownCoinInteger(v,label));
};
function ownCoinRequest(p:CoinProfile,event:string,extra:Record<string,string>={}):CoinRequest{
  return {event,parameters:event==='FREE_GAME'?{...p.freeRequestParams}:{GN:p.runtimeSlug,CFG:String(p.cfg),...extra}};
}
function ownCoinChoose(p:CoinProfile,s:CoinState):CoinRequest{
  assert(s.totalPicks!==undefined,'AG integrity: Coin Combo actual pick total absent');
  if(s.choices.length>=s.totalPicks)return ownCoinRequest(p,'FEATURE_END');
  // Both own fixed SDKs construct a 3*5 physical grid and emit its zero-based
  // index. This domain is not inherited from a different game's picker.
  const slot=Array.from({length:15},(_,i)=>i).find(i=>!s.choices.includes(i));
  assert(slot!==undefined,'AG integrity: Coin Combo no unconsumed physical choice');
  return ownCoinRequest(p,'FEATURE_PICK',{FP:`1|${s.choices.length+1}|${slot}`});
}
// Exact Perfect Peacock 32729 SDK06245. No provider response/ACK is made here.
type Own32729PickerState={started:boolean;cfg:number;ordinal:number};
function own32729Boolean(raw:string,label:string):boolean{
  const numeric=raw===''?null:Number(raw);
  if(numeric!==null&&!Number.isNaN(numeric))return numeric!==0;
  const value=raw.toLowerCase();if(['true','y','yes'].includes(value))return true;
  assert(['false','n','no'].includes(value),'AG integrity: own32729 '+label);return false;
}
function own32729ClearPicker(s:CoinState):void{
  s.featureActive=false;s.totalPicks=undefined;s.choices=[];
  s.own32729Picker={started:false,cfg:-1,ordinal:-1};
}
function own32729FeatureRequest(p:CoinProfile,s:CoinState,event:string,extra:Record<string,string>={}):CoinRequest{
  assert(s.own32729Picker,'AG integrity: own32729 picker state absent');
  // Own Iaa returns actual model $K, including its logged -1. No CFG tuple whitelist.
  return {event,parameters:{GN:p.runtimeSlug,CFG:String(s.own32729Picker.cfg),...extra}};
}
function own32729BuildFeatureRequest(p:CoinProfile,s:CoinState,event:string):CoinRequest{
  const model=s.own32729Picker;
  assert(model&&s.featureActive===true,'AG integrity: own32729 actual feature selector unmapped');
  if(!model.started)return own32729FeatureRequest(p,s,event);
  assert(s.totalPicks!==undefined,'AG integrity: own32729 actual JPS count absent');
  if(model.ordinal>=s.totalPicks)return own32729FeatureRequest(p,s,event);
  const slot=Array.from({length:15},(_,i)=>i).find(i=>!s.choices.includes(i));
  assert(slot!==undefined,'AG integrity: own32729 no unconsumed physical choice');
  return own32729FeatureRequest(p,s,event,{FP:`1|${s.choices.length+1}|${slot}`});
}
function own32729DecodedFTVIsTruthy(wire:Record<string,string>):boolean{
  // Own hw optional decoder starts with [] and changes the entire property to
  // null only on a decoding error. Values themselves are unused by the picker.
  for(const [key,raw] of Object.entries(wire)){
    const suffix=key.startsWith('FTV_')?key.slice(4):'';
    const index=Number.parseInt(suffix,10);
    if(suffix===''||Number.isNaN(index)||String(index)!==suffix)continue;
    const rows=raw.split('|');rows.pop();
    for(const row of rows){const values=row.split(';');values.pop();
      if(values.some(value=>value.trim()===''||Number.isNaN(Number(value))))return false;
    }
  }
  return true;
}
function own32729DecodedStarted(wire:Record<string,string>,cfg:number):boolean{
  let started=false;
  // The own hw decoder decodes the full indexed FS property before y6a
  // indexes it. A bad indexed value makes that property null, never true.
  for(const [key,raw] of Object.entries(wire)){
    const suffix=key.startsWith('FS_')?key.slice(3):'',index=Number.parseInt(suffix,10);
    if(suffix===''||Number.isNaN(index)||String(index)!==suffix)continue;
    const value=own32729Boolean(raw,'FS');if(index===cfg)started=value;
  }
  return started;
}
export function updateOwn32729Next(p:CoinProfile,s:CoinState,event:string,
  wire:Record<string,string>,ownGSD:Record<string,string>):void{
  assert(p.gameId==='32729'&&p.cfg===2&&p.pickTotal==='own-GSD-JPS-length',
    'AG integrity: own32729 exact profile');
  assert(wire.REC===undefined&&(wire.R===undefined||wire.R==='0'),
    'AG integrity: own32729 recovery unmapped');
  if(event==='BET'){
    assert(!s.next,'AG integrity: own32729 previous round pending');
    own32729ClearPicker(s);
  }else assert(s.lastRequested?.event===event,'AG integrity: own32729 requested event absent');
  // Own NFG Integer decoder declares default 0, independently on every response.
  s.freeRemaining=wire.NFG===undefined?0:ownCoinInteger(wire.NFG,'own32729 NFG');
  const cfg=wire.CFG===undefined?undefined:ownCoinInteger(wire.CFG,'own32729 CFG');
  const model=s.own32729Picker!;
  // Own Wl.ij calls p6a before J9a: its GSD.FID JSON selection clears tc.tf
  // when absent/empty. Hy is this same parsed value, not root FID's Postfix array.
  const selected=ownGSD.FID===undefined?null:JSON.parse(ownGSD.FID);
  if(!(selected&&0<selected.length))s.featureActive=false;
  // Own J9a/y6a. hw fields decode to [] even when no FTV key exists; neither
  // nonempty FTV rows nor a future display-value count initializes this model.
  if(cfg===2||s.featureActive===true){
    if(cfg){
      if(own32729DecodedFTVIsTruthy(wire)){
        assert(ownGSD.JPS!==undefined,'AG integrity: own32729 actual GSD JPS absent');
        const prizes=ownGSD.JPS.split(';');
        assert(prizes.every(value=>value.trim()!==''&&Number.isInteger(Number(value))),
          'AG integrity: own32729 actual JPS Integer array');
        s.totalPicks=prizes.length;
        s.featureActive=true;model.cfg=cfg;
      }
      model.started=own32729DecodedStarted(wire,cfg);
    }else if(selected&&selected.some((id:unknown)=>id===2)){
      s.featureActive=false;
    }
  }else own32729ClearPicker(s);
  // The three callbacks run only after the actual response passed the common
  // success/envelope/event and original AG cash checks. Request construction
  // already consumed a PICK in retainRequestedCoinAction, just like own X1a.
  if(event==='FEATURE_END')own32729ClearPicker(s);
  else if(event==='FEATURE_START'){
    s.own32729Picker!.started=true;
    assert(s.featureActive===true,'AG integrity: own32729 START callback feature selector unmapped');
  }else if(event==='FEATURE_PICK'){
    assert(s.featureActive===true,'AG integrity: own32729 PICK callback feature selector unmapped');
  }
  // Own Fk orders active Jackpot before FreeSpins; Yqa takes first non-null cz.
  // This is the own dispatcher, not the FREE request factory's local fallback.
  if(s.featureActive===true){
    // Actual callback chooses the message entry; own MH independently chooses
    // its body from current tf/Uy/UL/uH. Do not replace that with a CFG tuple.
    const nextEvent=event==='FEATURE_START'?'FEATURE_PICK':event==='FEATURE_PICK'?
      (s.choices.length>=s.totalPicks!?'FEATURE_END':'FEATURE_PICK'):
      (s.own32729Picker!.started?'FEATURE_PICK':'FEATURE_START');
    s.next=own32729BuildFeatureRequest(p,s,nextEvent);
  }
  else if(wire.GCT!==undefined&&own32729Boolean(wire.GCT,'GCT'))s.next=undefined;
  else if(s.freeRemaining>0)s.next=ownCoinRequest(p,'FREE_GAME');
  else {
    // Fresh GoldJackpotPick is not initialized by J9a. It needs its own real
    // positive bridge; do not pretend that unsupported feature is a terminal.
    assert(event==='FEATURE_END'||cfg===undefined||cfg===0||cfg===1||cfg===-1,
      'AG integrity: own32729 actual next/end unmapped');
    s.next=undefined;
  }
  s.lastRequested=undefined;
}

export function retainRequestedCoinAction(s:CoinState,actual:CoinRequest):void{
  assert(s.next,'AG integrity: Coin Combo no mapped next request');
  assert.deepStrictEqual(actual,s.next,'AG integrity: Coin Combo actual next fields');
  // Called for a newly selected request, never to retry a prior POST.
  s.lastRequested=structuredClone(actual);
  if(s.own32729Picker&&actual.event==='FEATURE_PICK'&&actual.parameters.FP!==undefined){
    // Own MH.$Ua calls X1a during construction, before this POST or its ACK.
    const fp=ownCoinVector(actual.parameters.FP,'|','infix','own32729 requested FP');
    assert(fp.length===3&&s.totalPicks!==undefined&&s.own32729Picker.ordinal<s.totalPicks,
      'AG integrity: own32729 actual PICK construction');
    s.choices.push(fp[2]);s.own32729Picker.ordinal=s.choices.length;
  }
}
export function updateOwnCoinComboNext(p:CoinProfile,s:CoinState,event:string,
  wire:Record<string,string>,ownGSD:Record<string,string>):void{
  if(p.gameId==='32729')return updateOwn32729Next(p,s,event,wire,ownGSD);
  assert(p.gameId==='32590'&&p.cfg===1&&p.pickTotal==='own-FTV-first-row-index-one',
    'AG integrity: Coin Combo exact own profile');
  assert(wire.REC===undefined&&(wire.R===undefined||wire.R==='0'),
    'AG integrity: Coin Combo recovery unmapped');
  if(event==='BET'){assert(!s.next,'AG integrity: Coin Combo previous round pending');s.choices=[];s.totalPicks=undefined;s.freeRemaining=undefined;s.featureActive=false;if(p.gameId==='32590')s.own32590FTV=undefined;}
  else {assert(s.lastRequested?.event===event,'AG integrity: Coin Combo own requested event absent');}
  // Called only after this own response passed envelope/event and original AG cash checks.
  const own32590EndCallback=p.gameId==='32590'&&event==='FEATURE_END';
  if(own32590EndCallback){s.featureActive=false;s.choices=[];s.totalPicks=undefined;s.own32590FTV=undefined;}
  // Own response decoder defaults missing NFG to zero; after real END callback no picker remains.
  s.freeRemaining=wire.NFG===undefined?(own32590EndCallback?0:undefined):ownCoinInteger(wire.NFG,'actual NFG');
  // Only an explicit own terminal flag closes an active path without an actual
  // terminal counter. A missing active NFG is not fabricated as zero.
  if(wire.GCT!==undefined&&ownCoinBoolean(wire.GCT,'actual GCT')){s.next=undefined;s.lastRequested=undefined;return;}
  if(event==='FEATURE_PICK'){
    assert(s.lastRequested?.parameters.CFG===String(p.cfg),
      'AG integrity: Coin Combo prior request CFG absent');
    const fp=ownCoinVector(s.lastRequested.parameters.FP,'|','infix','own requested FP');
    assert(fp.length===3&&fp[0]===1&&fp[1]===s.choices.length+1&&fp[2]>=0&&fp[2]<15&&!s.choices.includes(fp[2]),
      'AG integrity: Coin Combo actual own physical request');
    s.choices.push(fp[2]);
  }
  // Own32590 nbb keeps its active model unless absent/zero CFG plus FID selects clearing it.
  if(p.gameId==='32590'&&s.featureActive===true&&(!wire.CFG||Number(wire.CFG)===0)&&
    wire.FID!==undefined&&wire.FID.split('|').slice(0,-1).some(id=>Number(id)===p.cfg))s.featureActive=false;
  // Own FTV is an outer Postfix array: empty decoded rows do not initialize the Jackpot.
  const own32590FTV=wire[`FTV_${p.cfg}`];
  const own32590PickerDispatch=p.gameId==='32590'&&!own32590EndCallback&&(s.featureActive===true||
    Number(wire.CFG)===p.cfg&&own32590FTV!==undefined&&own32590FTV.split('|').slice(0,-1).length>0);
  if(s.freeRemaining!==undefined&&s.freeRemaining>0&&!own32590PickerDispatch){
    s.next=ownCoinRequest(p,'FREE_GAME');s.lastRequested=undefined;return;
  }
  const cfg=wire.CFG===undefined||wire.CFG===''?undefined:ownCoinInteger(wire.CFG,'actual CFG');
  assert(cfg===undefined||cfg===p.cfg||p.freeCFGs.includes(cfg)||p.inactiveCFGs.includes(cfg),
    'AG integrity: Coin Combo actual CFG next unmapped');
  if(wire.FID!==undefined){const ids=ownCoinVector(wire.FID,'|','postfix','actual FID');assert(ids.every(i=>i===p.cfg||p.freeCFGs.includes(i)),'AG integrity: Coin Combo actual FID next unmapped');}
  // The completed request's CFG is consumed before the response CFG selects
  // another stage. There is no tuple whitelist or forced End response.
  const own32590RetainedCallback=p.gameId==='32590'&&s.featureActive===true&&cfg===undefined&&
    (event==='FEATURE_START'||event==='FEATURE_PICK');
  if((cfg===p.cfg||own32590RetainedCallback)&&!own32590EndCallback){
    const rawStarted=wire[`FS_${p.cfg}`];
    // Own START callback sets started after its real successful response; omitted CFG retains its model.
    const started=p.gameId==='32590'&&event==='FEATURE_START'||own32590RetainedCallback?true:
      rawStarted===undefined?false:ownCoinBoolean(rawStarted,'actual FS');
    if(p.pickTotal==='own-FTV-first-row-index-one'){
      const ftv=wire[`FTV_${p.cfg}`];
      if(ftv!==undefined){const rows=ftv.split('|');rows.pop();if(rows.length>0){s.own32590FTV=ftv;s.featureActive=true;}}
    }else if(wire[`FTV_${p.cfg}`]!==undefined){
      assert(ownGSD.JPS!==undefined,'AG integrity: Coin Combo own JPS absent');
      s.totalPicks=ownCoinVector(ownGSD.JPS,';','infix','own JPS').length;s.featureActive=true;
    }
    assert(s.featureActive===true,'AG integrity: Coin Combo feature next not initialized by own FTV');
    if(!started){if(event==='FEATURE_END')s.choices=[];s.next=ownCoinRequest(p,'FEATURE_START');}
    else {
      // Fresh scope has nr=false. Own SDK hydrates FPM choices only for nr===true;
      // this candidate keeps recovery unmapped and retains only its own current requests.
      // START requires only active state. Decode its own retained FTV count when a PICK is actually needed.
      if(p.gameId==='32590'&&s.own32590FTV!==undefined){const rows=s.own32590FTV.split('|');rows.pop();assert(rows.length>0,'AG integrity: Coin Combo own FTV first row absent');const row=rows[0].split(';');row.pop();assert(row.length>=2,'AG integrity: Coin Combo actual FTV pick count absent');s.totalPicks=ownCoinInteger(row[1],'own NumberOfPicks');}
      assert(s.totalPicks!==undefined&&s.totalPicks>0&&s.totalPicks<=15,
        'AG integrity: Coin Combo actual finite physical picks absent');
      s.next=ownCoinChoose(p,s);
    }
  }else if(s.freeRemaining!==undefined){
    if(own32590EndCallback&&s.freeRemaining<=0)assert(cfg!==p.cfg,'AG integrity: Coin Combo own END returned pending CFG unmapped');
    s.next=s.freeRemaining>0?ownCoinRequest(p,'FREE_GAME'):undefined;
  }else {
    assert(event==='BET'&&wire.FID===undefined&&(cfg===undefined||p.inactiveCFGs.includes(cfg)),
      'AG integrity: Coin Combo active next/end evidence absent');
    // This exact fresh ordinary scope uses the own SDK's declared NFG default.
    s.next=undefined;
  }
  s.lastRequested=undefined;
}


const ownCoinComboProfiles:Record<string,any>={"32590":{"gameId":"32590","runtimeSlug":"mightymonkeycoincombo96","cfg":1,"freeRequestParams":{"GN":"mightymonkeycoincombo96","BPR":"108","RB":"5"},"freeCFGs":[0],"pickTotal":"own-FTV-first-row-index-one","ownSDKFileSHA256":"00995533ce53fcbc060385d71c251fddc6a7545ca0f95824a35c0d2c793c2a8b","dbName":"sg_mightymonkeycoincombo96","runtimeGameId":33064,"sourcePointProofSHA256":"95874b356bfdd385832d7dbefe11bb089d84ddaa4a732e005cfc240189c6221e","physicalChoices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],"originalAGAmountReplayMongoChecksRequired":true,"noOldUnknownPOSTReplay":true,"unmappedActualNextStops":true,"providerFeatureACKsObservedInThisPackage":0,"inactiveCFGs":[]},"32729":{"gameId":"32729","runtimeSlug":"coincomboperfectpeacock96","cfg":2,"freeRequestParams":{"BPR":"88","GN":"coincomboperfectpeacock96","RB":"5"},"freeCFGs":[0,1],"pickTotal":"own-GSD-JPS-length","ownSDKFileSHA256":"06245d78fdff91ed48d7790545be5f7cbe051246a957093845f8f8b100d3b2b0","dbName":"sg_coincomboperfectpeacock96","runtimeGameId":33129,"sourcePointProofSHA256":"95874b356bfdd385832d7dbefe11bb089d84ddaa4a732e005cfc240189c6221e","physicalChoices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],"originalAGAmountReplayMongoChecksRequired":true,"noOldUnknownPOSTReplay":true,"unmappedActualNextStops":true,"providerFeatureACKsObservedInThisPackage":0,"inactiveCFGs":[-1],"own32729DispatchContract":"own32729-SDK06245-p6a-MH-callback-v1","own32729NewPointProofsSHA256":{"own32729-serializer-points-v2.json":"e1f22139081b5aa471d1f1b6b1092e0fe506682acc23303fbb3d1008d8518839","own32729-callback-points-v3.json":"eafd2e355ee4ffc46eccf99dc33d7f16c5ecf6c19f0668f655b1c34787bede14","own32729-dispatch-points-v3.json":"f45cd60b7f9981ef50b1ad6c019df34205729e437829d067c045cb706bae0707","own32729-response-order-p6a-review.json":"a3de7bb3bed4fb3fd3aca7e816db5c365005c827f94845873b0d4214082c651e","own32729-scalar-points-v4.json":"239c4be16a237bc5da661ece6b15b5745777768264f12ee14a41db1dfcbefe9d"}}};
export function ownCoinComboProfile(game:AGGameConfig):CoinProfile|undefined {
 const c=game.sg?.ownGDMContract,b=c?.ownCoinComboNextEndOnly;if(!b)return undefined;
 const p=ownCoinComboProfiles[game.gameId];
 assert(p&&game.provider==='sg'&&game.dbName===p.dbName&&game.sg.runtimeGameId===p.runtimeGameId&&game.sg.runtimeSlug===p.runtimeSlug&&c.ownSDKFileSHA256===p.ownSDKFileSHA256,'AG integrity: Coin Combo own identity');
 assert.deepStrictEqual(b,p,'AG integrity: Coin Combo fixed SDK next/end binding');
 assert.deepStrictEqual(game.sg.requestParams,p.freeRequestParams,'AG integrity: Coin Combo own paid request');
 assert.deepStrictEqual(c.freeBudgetContract.freeRequestParams,p.freeRequestParams,'AG integrity: Coin Combo own FREE request');return p;
}

type GDMWireStep={msgId:string;methodName:string;requestPayload:string;responsePayload:string;responseXml:string;responseBalance?:number;httpStatus?:number;elapsedMs?:number};
type GDMTransport=(event:string,payload:string)=>Promise<GDMWireStep>;
const gdmParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false});
const gdmInteger=(v:unknown,label:string)=>{assert(typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v),'AG integrity: GDM '+label);const n=Number(v);assert(Number.isSafeInteger(n),'AG integrity: GDM unsafe '+label);return n;};
const gdmEscape=(v:unknown)=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function ownGDMFields(value:string,separator='&',assignment='='):Record<string,string>{
 assert(typeof value==='string','AG integrity: GDM form input');const out:Record<string,string>=Object.create(null);
 for(const part of value.split(separator)){if(!part)continue;const at=part.indexOf(assignment);assert(at>0,'AG integrity: GDM form field');const k=part.slice(0,at);assert(!Object.prototype.hasOwnProperty.call(out,k),'AG integrity: GDM duplicate field');out[k]=part.slice(at+assignment.length);}
 return out;
}
export type OwnChain32476Request={event:'ACK'|'FREE_GAME',parameters:Record<string,string>};
export type OwnChain32476State={pending?:OwnChain32476Request,ackMode?:'one-empty-cascade'|'until-last-ack',remaining?:number,gct?:boolean,actualSpinTW?:number};
const OWN_CHAIN_FREE={GN:'chainreactorsdeluxe96',BPL:'10',LB:'5'};
function ownChainInteger(raw:string,label:string):number{
 if(typeof raw!=='string'||raw.trim()==='')throw Error('own32476 actual integer '+label);
 const n=Number(raw);if(!Number.isFinite(n)||!Number.isInteger(n))throw Error('own32476 finite integer '+label);return n;
}
export function ownChainBoolean(raw:string|undefined):boolean{
 if(raw===undefined)return false; // own SDK GCT defaultValue false
 const n=raw===''?null:Number(raw);if(n!==null&&!Number.isNaN(n))return n!==0; // own Tl.la + pQ, not a finite-money decoder
 const s=raw.toLowerCase();if(['true','y','yes'].includes(s))return true;if(['false','n','no'].includes(s))return false;
 throw Error('own32476 unknown GCT decoder');
}
export function ownChainDecodedCL(gsd:Record<string,string>):any[]{
 // Own generic rq decoder creates an array, then assigns canonical numeric indices.
 // The actual own CL type is Infix('|') -> Postfix(';') -> Infix(',') -> Integer.
 const out:any[]=[];
 for(const key of Object.keys(gsd)){
  if(!key.startsWith('CL_'))continue;const index=parseInt(key.slice(3));
  if(Number.isNaN(index)||key.slice(3)!==String(index))continue;
  out[index]=gsd[key].split('|').map(row=>{const cells=row.split(';');cells.pop();return cells.map(cell=>cell.split(',').map(raw=>ownChainInteger(raw,'CL Integer')));});
 }
 return out;
}
function afterOwnChainRenderedACKs(state:OwnChain32476State){
 // Own actual P6 uses truthiness, not a positive-only counter gate.
 if(state.remaining===undefined||state.gct===undefined)throw Error('own32476 lost actual spin selector');
 state.pending=state.remaining!==0&&!state.gct?{event:'FREE_GAME',parameters:{...OWN_CHAIN_FREE}}:undefined;
}
export function updateOwnChain32476Next(state:OwnChain32476State,event:string,p:Record<string,string>,gsd:Record<string,string>){
 if(event==='BET'||event==='FREE_GAME'){
  if(event==='BET'){if(state.pending)throw Error('own32476 previous actual request pending');}
  else{if(state.pending?.event!=='FREE_GAME')throw Error('own32476 actual FREE request not pending');state.pending=undefined;}
  // The new own successful spin response replaces these SDK fields; no retained absent NFG.
  state.remaining=p.NFG===undefined?0:ownChainInteger(p.NFG,'NFG');state.gct=ownChainBoolean(p.GCT);
  // Optional own GSD.RI decodes null and own ph explicitly initializes Qj=0.
  // Present RI is used; no fallback of an invalid actual RI.
  const ri=gsd.RI===undefined?0:ownChainInteger(gsd.RI,'GSD.RI')+1;
  if(!Number.isFinite(ri)||!Number.isInteger(ri))throw Error('own32476 next RI outside finite domain');
  const hasCL=ownChainDecodedCL(gsd).length>0;
  const ownLastACK=gsd.LAST_ACK!==undefined&&ownChainInteger(gsd.LAST_ACK,'GSD.LAST_ACK')===1;
  if(hasCL&&ownLastACK){state.ackMode=undefined;afterOwnChainRenderedACKs(state);return;}
  // gBa empty CL still performs one actual ACK. gy with cascades waits for actual LAST_ACK.
  state.ackMode=hasCL?'until-last-ack':'one-empty-cascade';state.pending={event:'ACK',parameters:{GN:OWN_CHAIN_FREE.GN,RI:String(ri)}};return;
 }
 if(event!=='ACK'||state.pending?.event!=='ACK'||!state.ackMode)throw Error('own32476 ACK caller state not mapped');
 const ri=ownChainInteger(p.RI,'actual ACK.RI');const last=p.LAST_ACK!==undefined&&ownChainInteger(p.LAST_ACK,'actual ACK.LAST_ACK')===1;
 // Called only after genuine successful decode/exchange, never after ERROR/unknown.
 if(state.ackMode==='until-last-ack'&&!last){const next=ri+1;if(!Number.isFinite(next)||!Number.isInteger(next))throw Error('own32476 next ACK RI outside finite domain');state.pending={event:'ACK',parameters:{GN:OWN_CHAIN_FREE.GN,RI:String(next)}};return;}
 state.ackMode=undefined;state.pending=undefined;afterOwnChainRenderedACKs(state);
}


const ownChain32476Binding:Record<string,any>={"version":"own32476-ACK-next-only-v1","gameId":"32476","dbName":"sg_chainreactorsdeluxe96","runtimeGameId":33028,"runtimeSlug":"chainreactorsdeluxe96","ownSDKFileSHA256":"3059dbaff4c0013e302f9084c5943ce11fd8a64910d23b72f7bc39adc0606e1b","ownControlPointProofSHA256":"5aa5d4ee27dac02fef58d228e9e86aca3978542b0507cbde79fed6634e16bca5","paidRequestParams":{"GN":"chainreactorsdeluxe96","AP":"false","BPL":"10","LB":"5"},"freeRequestParams":{"GN":"chainreactorsdeluxe96","BPL":"10","LB":"5"},"ACKRequiredOwnRequestFields":["GN","RI"],"ACKDoesNotInventTWOrEnd":true,"ownQjZeroOnlyInNewSpinPHContext":true,"ownPostSuccessACKCallbackRequired":true};
function ownChain32476Profile(game:AGGameConfig){
 const c=game.sg?.ownGDMContract;if(c?.ownChain32476ACK===undefined)return false;
 assert(game.provider==='sg'&&game.gameId==='32476'&&game.dbName==='sg_chainreactorsdeluxe96'&&game.backendId==='chainreactorsdeluxe96'
  &&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33028&&game.sg.runtimeSlug==='chainreactorsdeluxe96','AG integrity: own32476 ACK exact game');
 assert(c.version==='own32476-ACK-next-only-v1'&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===game.sg.runtimeGameId&&c.runtimeSlug===game.sg.runtimeSlug
  &&c.ownSDKFileSHA256===ownChain32476Binding.ownSDKFileSHA256&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&c.betRaw===game.sg.betRaw&&c.betRaw===10&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32476 ACK own binding');
 assert.deepStrictEqual(c.ownChain32476ACK,ownChain32476Binding,'AG integrity: own32476 ACK source profile');assert.deepStrictEqual(game.sg.requestParams,ownChain32476Binding.paidRequestParams,'AG integrity: own32476 ACK paid fields');return true;
}

// Private control projection of this game's own b6e937 SDK points only.
// Wired only to exact own32681. GN is certified connection identity; CM omits AP.
// No SDK service, provider response, actual ACK or production terminal is made.
export type Own32681FeatureEvent='FEATURE_START'|'FEATURE_PICK'|'FEATURE_END';
export type Own32681Event='BET'|'FREE_GAME'|Own32681FeatureEvent;
export type Own32681EC={jf:boolean,Qy:boolean|undefined,yK:number|undefined,zz:number,jG:number,wG:number[]};
export type Own32681Control={ec:Own32681EC,remaining:number|null,gct:boolean|null,rootCFG:number|null,freeUI:boolean,caller?:Own32681FeatureEvent,afterSuccessfulEND:boolean};
export type Own32681Decoded={NFG:number|null,GCT:boolean|null,CFG:number|null,ownGSDFID:number[]|null,FS:Array<boolean|undefined>|null,FTV:number[][][]|null,JPS:number[]|null};
export function clearOwn32681EC(prior?:Own32681EC):Own32681EC{return{jf:false,Qy:false,yK:prior?.yK,zz:-1,jG:-1,wG:[]};}
export function createOwn32681Control():Own32681Control{return{ec:clearOwn32681EC(),remaining:0,gct:false,rootCFG:null,freeUI:false,afterSuccessfulEND:false};}
export function own32681CtorKind(ec:Own32681EC):Own32681FeatureEvent|undefined{
 // Exact T.sa.Jp. This initial ctor kind determines fields; service JF later
 // supplies the actual MSGID selected by the caller's UI/callback phase.
 if(!ec.jf)return undefined;
 return !ec.Qy?'FEATURE_START':ec.jG>=ec.zz?'FEATURE_END':'FEATURE_PICK';
}
export function applyOwn32681SuccessfulDecoded(s:Own32681Control,event:Own32681Event,p:Own32681Decoded){
 // The session must first verify successful native envelope/MSGID and decode
 // these fields with own b6e937 codecs. Missing NFG=0 is an SDK field default,
 // not a callback/cash default. No raw response is fabricated here.
 s.remaining=p.NFG;s.gct=p.GCT;s.rootCFG=p.CFG;s.afterSuccessfulEND=false;
 // U4a reads JSON.parse(Ye.BXa), the own GSD.FID string, not root FID.
 // Actual optional-null is represented as null, never replaced by '[]'.
 if(p.ownGSDFID&&p.ownGSDFID.length){if(p.ownGSDFID[0]!==2)s.freeUI=true;}
 else{s.freeUI=false;s.ec.jf=false;}
 // Exact own G8a/c5a order follows U4a.
 if(p.CFG===2||s.ec.jf){
  if(p.CFG){
   // [] and [[]] are both truthy native FTV aggregates. Malformed optional
   // FTV becomes null. A nonempty-only predicate would change this SDK.
   if(p.FTV){
    if(p.JPS===null)throw Error('own32681 actual JPS length unavailable in c5a');
    s.ec.zz=p.JPS.length;s.ec.jf=true;s.ec.yK=p.CFG;
   }
   if(p.FS===null)throw Error('own32681 actual FS aggregate unavailable in c5a');
   s.ec.Qy=p.FS[p.CFG];
  }else if(p.ownGSDFID?.some(x=>x===2))s.ec.jf=false;
 }else s.ec=clearOwn32681EC(s.ec);
 if(event==='FEATURE_START'){
  // Own c$a runs only after Aaa exact-type response Ti/serviceTi succeeds.
  s.ec.Qy=true;s.caller='FEATURE_PICK';
 }else if(event==='FEATURE_PICK'){
  // Own OXa uses the choices already consumed by the request constructor.
  s.caller=s.ec.wG.length>=s.ec.zz?'FEATURE_END':'FEATURE_PICK';
 }else if(event==='FEATURE_END'){
  // Own hUa: successful response, animation, Ko.clear, then free/terminal.
  // Failure/ERROR never reaches this function and never clears state.
  s.ec=clearOwn32681EC(s.ec);s.caller=undefined;s.afterSuccessfulEND=true;
  if(s.remaining!==null&&s.remaining>0)s.freeUI=true;
 }else s.caller=undefined;
}
export function own32681ControlNext(s:Own32681Control,actualPlatformFreeRoundsPending:boolean){
 if(actualPlatformFreeRoundsPending)throw Error('own32681 platform FreeRounds request unmapped');
 // Gj.fw is unconditionally null. No universal GCT-first override is added.
 const event=s.caller??(s.ec.jf?(s.ec.Qy?'FEATURE_PICK':'FEATURE_START'):undefined);
 if(event)return{event,ctorKind:own32681CtorKind(s.ec),externalBinderStillRequired:true as const};
 if(s.remaining!==null&&s.remaining>0&&!s.gct)return{event:'FREE_GAME' as const,externalBinderStillRequired:true as const};
 // These are control facts only. The actual session still needs a real
 // successful response and original AG amount/round/Mongo validation.
 if(s.afterSuccessfulEND||s.gct||!(s.remaining!==null&&s.remaining>0||s.rootCFG===2))return{event:null,controlTerminal:true as const};
 throw Error('own32681 actual pending selector remains unmapped');
}
export function own32681SerializedOptionalCFG(value:number|null|undefined):Record<string,string>{return value==null?{}:{CFG:String(value)};}
export function own32681FeatureFieldsAndConsume(s:Own32681Control,event:Own32681FeatureEvent){
 const kind=own32681CtorKind(s.ec);
 if(kind===undefined)throw Error('own32681 actual request constructor has no selected feature');
 if(s.ec.yK===undefined)throw Error('own32681 actual current CFG unavailable');
 const fields=own32681SerializedOptionalCFG(s.ec.yK);
 if(kind==='FEATURE_PICK'){
  if(event!=='FEATURE_PICK')throw Error('own32681 actual constructor requires caller choice');
  // Actual own UI index policy: choose an available unselected grid index.
  const choice=Array.from({length:15},(_,i)=>i).find(i=>!s.ec.wG.includes(i));
  if(choice===undefined)throw Error('own32681 actual picker has no mapped available choice');
  fields.FP=`1|${s.ec.wG.length+1}|${choice}`;
  // Literal q0a consumes before transport. No successful ACK is inferred.
  if(s.ec.jG<s.ec.zz){s.ec.wG.push(choice);s.ec.jG=s.ec.wG.length;}
 }
 // Optional null FP is omitted for ctor START/END. Event is not silently
 // changed to ctor kind: own I7a serializes the service/caller JF MSGID.
 return{event,fields,externalBinderStillRequired:true as const};
}

// Exact own32681 primitive codecs. Unused display values do not gain gates.
function own32681Integer(raw:string,label:string){
 if(typeof raw!=='string'||raw.trim()==='')throw Error('own32681 actual Integer '+label);
 const n=Number(raw);if(!Number.isFinite(n)||!Number.isInteger(n))throw Error('own32681 actual Integer '+label);return n;
}
export function own32681Boolean(raw:string|undefined):boolean{
 if(raw===undefined)return false;
 const n=raw===''?null:Number(raw);if(n!==null&&!Number.isNaN(n))return n!==0;
 const s=raw.toLowerCase();if(['true','y','yes'].includes(s))return true;if(['false','n','no'].includes(s))return false;
 throw Error('own32681 actual Boolean');
}
function own32681Indexed<T>(w:Record<string,string>,prefix:string,decode:(v:string)=>T):Array<T>|null{
 const a:Array<T>=[];
 try{for(const k of Object.keys(w)){if(!k.startsWith(prefix))continue;const n=parseInt(k.slice(prefix.length));if(Number.isNaN(n)||String(n)!==k.slice(prefix.length))continue;(a as any)[n]=decode(w[k]);}return a;}catch{return null;}
}
export function own32681DecodeControl(w:Record<string,string>,g:Record<string,string>):Own32681Decoded{
 const parseNumber=(v:string)=>{if(v.trim()===''||Number.isNaN(Number(v)))throw Error('own32681 Number');return Number(v);};
 const post=(v:string,separator:string)=>{const a=v.split(separator);a.pop();return a;};
 const FTV=own32681Indexed(w,'FTV_',v=>post(v,'|').map(row=>post(row,';').map(parseNumber)));
 const FS=own32681Indexed(w,'FS_',v=>own32681Boolean(v));
 // Native c5a indexes UUa directly. A malformed indexed aggregate is null;
 // no matching fields is [], with an undefined (not fabricated false) index.
 let JPS:number[]|null=null;try{if(g.JPS!==undefined)JPS=g.JPS.split(';').map(v=>own32681Integer(v,'JPS'));}catch{JPS=null;}
 // Own U4a calls JSON.parse on optional decoded-null; never substitute [].
 const ownGSDFID=JSON.parse(g.FID===undefined?'null':g.FID);
 if(ownGSDFID!==null&&(!Array.isArray(ownGSDFID)||!ownGSDFID.every((v:any)=>typeof v==='number'&&Number.isFinite(v)&&Number.isInteger(v))))throw Error('own32681 actual GSD.FID selector unmapped');
 let CFG:number|null=null;try{if(w.CFG!==undefined)CFG=own32681Integer(w.CFG,'CFG');}catch{CFG=null;}
 let NFG:number|null=0,GCT:boolean|null=false;try{if(w.NFG!==undefined)NFG=own32681Integer(w.NFG,'NFG');}catch{NFG=null;}try{GCT=own32681Boolean(w.GCT);}catch{GCT=null;}
 return{NFG,GCT,CFG,ownGSDFID,FS,FTV,JPS};
}
const ownTrinity32681Binding={"version":"own32681-next-end-only-v1","gameId":"32681","dbName":"sg_trinitypotsrisingwilds96","runtimeGameId":33094,"runtimeSlug":"trinitypotsrisingwilds96","ownSDKFileSHA256":"b6e937e7a6bcb41093a61c653c10e02212cb1a8640b44d410c98d41ad70e4036","ownPointProofsSHA256":{"own32681-first-pending-caller-points.json":"7c407ff19c831bf5d7771a8e55daeb7dbd7e777fd184d0ed24be6c0a98f6abf4","own32681-dispatch-callback-points.json":"1de29f87ed9522528dc3e2e4b24ac713972255a058fc82698b9ce7ccf25e5b7c","own32681-response-request-points.json":"5351bdab2fb2501b76817117283c80db6c2a49d6008cc34705f2be047c234d0b","own32681-stake-choice-followup-points.json":"643d10ab65aca381c8f209a7a6ea92f8a4d854b7274d47c27786f64abbebf783","own32681-Gj-priority-point.json":"ddf184df2e68dee8c00a6025bd2af78360456cde42c0164f61ba3336321b3f3d"},"paidRequestParams":{"GN":"trinitypotsrisingwilds96","AP":"false","BPR":"108","RB":"5"},"freeSerializedCMFields":["BPR","RB"],"freeRequestGNConnectionIdentity":"trinitypotsrisingwilds96","featurePhysicalDomain":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],"featureCFG":2,"callerRequestUnresolved":false,"noFREEAPBorrowed":true,"GNScopeDecisionSHA256":"2191394492df46a0bcf2b562e26a26c145abd97e0bd6b37bf1076eac34f574ba","actualProviderACKsInNewAffectedScope":0};
export function ownTrinity32681Profile(game:AGGameConfig){
 const c=game.sg?.ownGDMContract,b=c?.ownTrinity32681NextOnly;if(b===undefined)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32681'&&game.dbName==='sg_trinitypotsrisingwilds96'&&game.backendId==='trinitypotsrisingwilds96'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33094&&game.sg.runtimeSlug==='trinitypotsrisingwilds96','AG integrity: own32681 exact game');
 assert(c.version==='own32681-next-end-only-v1'&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===33094&&c.runtimeSlug===game.sg.runtimeSlug&&c.ownSDKFileSHA256===ownTrinity32681Binding.ownSDKFileSHA256&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&c.betRaw===108&&game.sg.betRaw===108&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32681 exact contract');
 assert.deepStrictEqual(b,ownTrinity32681Binding,'AG integrity: own32681 fixed next binding');assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: own32681 own BET fields');return b;
}

// Exact 32709 SDK projection. Controlled objects are not provider ACKs.
export type Own32709FeatureEvent='FEATURE_START'|'FEATURE_PICK'|'FEATURE_END';
export type Own32709Event='BET'|'FREE_GAME'|Own32709FeatureEvent;
export type Own32709Control={current:number,future:number,nfg:number|null,gct:boolean|null,nestedGCT:boolean|null,cap:number|null,totalWin:number,pe:{active:boolean,started:boolean|undefined,kind:number,total:number,choices:number[],backupTotal:number|undefined,JPT:boolean},fs:{active:boolean,started:boolean|undefined,endIndex:number|null},caller?:Own32709FeatureEvent,afterSelectEnd:boolean};
export type Own32709Decoded={NFG:number|null,GCT:boolean|null,nestedGCT:boolean|null,CFG:number|null,FID:number[]|null,FS:Array<boolean|undefined>|null,FTV:number[][][]|null,FPM:number[][][]|null,JPT:boolean|null};
export function createOwn32709Control():Own32709Control{return{current:-1,future:-1,nfg:0,gct:false,nestedGCT:false,cap:null,totalWin:0,pe:{active:false,started:false,kind:-1,total:-1,choices:[],backupTotal:undefined,JPT:false},fs:{active:false,started:false,endIndex:null},afterSelectEnd:false};}
export function own32709Integer(raw:string){if(raw.trim()===''||!Number.isFinite(Number(raw))||!Number.isInteger(Number(raw)))throw Error('own32709 Integer');return Number(raw);}
export function own32709Boolean(raw:string){const n=raw===''?null:Number(raw);if(n!==null&&!Number.isNaN(n))return n!==0;const s=raw.toLowerCase();if(['true','y','yes'].includes(s))return true;if(['false','n','no'].includes(s))return false;throw Error('own32709 Boolean');}
function own32709Optional<T>(raw:string|undefined,decode:(s:string)=>T,fallback:T|null=null):T|null{if(raw===undefined)return fallback;try{return decode(raw);}catch{return null;}}
function own32709Indexed<T>(w:Record<string,string>,prefix:string,decode:(s:string)=>T):T[]|null{const rows:T[]=[];try{for(const k of Object.keys(w)){if(!k.startsWith(prefix))continue;const n=parseInt(k.slice(prefix.length));if(Number.isNaN(n)||k.slice(prefix.length+String(n).length)!=='')continue;rows[n]=decode(w[k]);}return rows;}catch{return null;}}
export function own32709DecodeControl(w:Record<string,string>,g:Record<string,string>):Own32709Decoded{
 const number=(v:string)=>{if(v.trim()===''||Number.isNaN(Number(v)))throw Error('own32709 Number');return Number(v);};
 const postfix=(v:string,separator:string)=>{const a=v.split(separator);a.pop();return a;};
 const matrix=(v:string)=>postfix(v,'|').map(row=>postfix(row,';').map(number));
 return{NFG:own32709Optional(w.NFG,own32709Integer,0),GCT:own32709Optional(w.GCT,own32709Boolean,false),nestedGCT:own32709Optional(g.GCT,own32709Boolean,false),CFG:own32709Optional(w.CFG,own32709Integer),FID:own32709Optional(w.FID,v=>postfix(v,'|').map(own32709Integer)),FS:own32709Indexed(w,'FS_',own32709Boolean),FTV:own32709Indexed(w,'FTV_',matrix),FPM:own32709Indexed(w,'FPM_',matrix),JPT:own32709Optional(g.JPT,own32709Boolean,false)};
}
export function own32709Pq(s:Own32709Control){return s.current===-1?(s.pe.active?s.pe.kind:s.fs.active?0:-1):s.current;}
export function own32709CtorKind(s:Own32709Control):Own32709FeatureEvent|undefined{
 const kind=own32709Pq(s);
 if(kind===2||kind===3)return s.pe.active?(!s.pe.started?'FEATURE_START':s.pe.choices.length>=s.pe.total?'FEATURE_END':'FEATURE_PICK'):undefined;
 if(kind===0)return !s.fs.started?'FEATURE_START':s.fs.endIndex!==null&&s.fs.endIndex>=0?'FEATURE_END':'FEATURE_PICK';
 return undefined;
}
export function applyOwn32709SuccessfulDecoded(s:Own32709Control,event:Own32709Event,p:Own32709Decoded,requestKind?:number){
 s.nfg=p.NFG;s.gct=p.GCT;s.nestedGCT=p.nestedGCT;s.current=p.CFG??p.FID?.[0]??-1;s.future=p.FID?.[1]??-1;s.afterSelectEnd=false;s.pe.JPT=p.JPT??false;
 // PUa/V5a runs before either feature response initializer. Missing and empty
 // indexed arrays differ: an empty row array is still truthy for V5a.
 if(s.future!==-1&&p.FTV&&!p.FTV[s.current]&&p.FTV[s.future])s.current=s.future;
 const selected=s.current;
 if((selected===2||selected===3)&&p.FTV?.[selected]&&p.FTV[selected].length>0){
  if(p.FPM===null||p.FS===null)throw Error('own32709 active response indexed control unavailable');
  s.pe.active=true;s.pe.kind=selected;s.pe.total=p.FTV[selected].length;
  s.pe.choices=(p.FPM[selected]??[]).filter(row=>row.length>0).map(row=>row[0]);s.pe.started=p.FS[selected];
  if(selected===3){if(!p.FTV[2])throw Error('own32709 Gold backup FTV unavailable');s.pe.backupTotal=p.FTV[2].length;}
 }
 if(p.FID?.some(n=>n===0||n===1)){
  s.fs.active=true;
  if(own32709Pq(s)===0){if(p.FS===null||p.FPM===null)throw Error('own32709 free-select indexed control unavailable');s.fs.started=p.FS[0]??false;s.fs.endIndex=p.FPM[0]?.[0]?.[0]??null;}
 }
 s.caller=undefined;
 // These bodies run only after native envelope/type validation and response Ti.
 if(event==='FEATURE_START'){
  if(requestKind===0){s.fs.started=true;s.caller='FEATURE_PICK';}
  else if(requestKind===2||requestKind===3){s.pe.started=true;s.caller='FEATURE_PICK';}
  else throw Error('own32709 successful START callback scope unmapped');
 }else if(event==='FEATURE_PICK'){
  if(requestKind===0){if(s.fs.endIndex===null||s.fs.endIndex<0)throw Error('own32709 successful select PICK next unavailable');s.caller='FEATURE_END';}
  else if(requestKind===2||requestKind===3)s.caller=s.pe.choices.length>=s.pe.total?'FEATURE_END':'FEATURE_PICK';
  else throw Error('own32709 successful PICK callback scope unmapped');
 }else if(event==='FEATURE_END'){
  if(requestKind===0){s.fs.active=false;s.fs.started=false;s.fs.endIndex=-1;s.afterSelectEnd=true;}
  else if(requestKind===2){s.pe={active:false,started:false,kind:-1,total:-1,choices:[],backupTotal:undefined,JPT:false};if(s.future===0||s.future===1)s.current=s.future;}
  else if(requestKind===3){if(s.pe.backupTotal===undefined)throw Error('own32709 Gold callback backup unavailable');s.pe.active=true;s.pe.started=false;s.pe.kind=2;s.pe.total=s.pe.backupTotal;s.pe.choices=[];s.current=2;}
  else throw Error('own32709 successful END callback scope unmapped');
 }
}
export function own32709ControlNext(s:Own32709Control){
 const kind=own32709Pq(s);if(![-1,0,1,2,3].includes(kind))throw Error('own32709 actual feature selector unmapped');
 // Own registry invokes jackpot vF before free/select vF. Its fresh caller
 // uses equality; a successful PICK callback instead uses >= (both literal).
 let event=s.caller;
 if(event===undefined&&s.pe.active)event=!s.pe.started?'FEATURE_START':s.pe.choices.length===s.pe.total?'FEATURE_END':'FEATURE_PICK';
 if(event===undefined&&!s.afterSelectEnd&&kind===0)event=!s.fs.started?'FEATURE_START':s.fs.endIndex!==null&&s.fs.endIndex>=0?'FEATURE_END':'FEATURE_PICK';
 if(event!==undefined){if(own32709CtorKind(s)===undefined)throw Error('own32709 caller constructor selector unavailable');return{event,kind};}
 if(s.nfg!==null&&s.nfg>0&&!s.gct){
  if(s.nestedGCT)throw Error('own32709 nested GCT actual next unmapped');
  if(s.cap&&s.totalWin>=s.cap)throw Error('own32709 CAP suppresses FREE actual next unmapped');
  return{event:'FREE_GAME' as const,kind};
 }
 if(s.gct||!(s.nfg!==null&&s.nfg>0)){if(kind===1&&!s.pe.active)s.fs.active=false;return{event:null,kind};}
 throw Error('own32709 actual pending next unmapped');
}
export function own32709FeatureFieldsAndConsume(s:Own32709Control,event:Own32709FeatureEvent){
 const kind=own32709Pq(s),ctor=own32709CtorKind(s);if(ctor===undefined)throw Error('own32709 actual feature constructor unavailable');
 const fields:Record<string,string>={CFG:String(kind)};
 if(ctor==='FEATURE_PICK'){
  const count=kind===0?6:(s.pe.JPT||s.pe.active&&s.pe.kind===2)?12:6;
  if(kind!==0&&!s.pe.choices.every(n=>Number.isInteger(n)&&n>=0&&n<count))throw Error('own32709 actual restored physical choice unavailable');
  const choice=kind===0?0:Array.from({length:count},(_,i)=>i).find(n=>!s.pe.choices.includes(n));
  if(choice===undefined)throw Error('own32709 no mapped physical choice available');
  fields.FP=`${kind===0?1:s.pe.choices.length+1}|1|${choice}`;
  if(kind!==0&&s.pe.choices.length<s.pe.total)s.pe.choices.push(choice);
 }
 return{event,fields,ctorKind:ctor};
}

const ownDFDC32709Binding={"version":"own32709-next-end-only-v1","gameId":"32709","dbName":"sg_dfdcgdragons96","runtimeGameId":33109,"runtimeSlug":"dfdcgdragons96","ownSDKFileSHA256":"3a7501700677dfd5be2ba8f5274b62e7efed14a8a44a51230b9805c1f0c82d35","ownPointProofSHA256":"57040356602aed95b5f28d8222e9bc0ef88e1a47acdde776ad64881be10e87cf","paidRequestParams":{"GN":"dfdcgdragons96","AP":"false","BPR":"88","RB":"5"},"freeSerializedFields":["BPR","RB"],"featureFields":["CFG","FP"],"noFreeAPBorrowed":true,"fixtureProviderACKCredit":0,"ownIndexAndGAProofSHA256":"02fe7125f9a88fa44745e5f6a28d0017271f8ce32050d2a5a29835e480118f38","GAIsNotMandatoryNext":true};
export function ownDFDC32709Profile(game:AGGameConfig){
 const c=game.sg?.ownGDMContract,b=c?.ownDFDC32709NextOnly;if(b===undefined)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32709'&&game.dbName==='sg_dfdcgdragons96'&&game.backendId==='dfdcgdragons96'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33109&&game.sg.runtimeSlug==='dfdcgdragons96','AG integrity: own32709 exact game');
 assert(c.version==='own32709-next-end-only-v1'&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===33109&&c.runtimeSlug===game.sg.runtimeSlug&&c.ownSDKFileSHA256===ownDFDC32709Binding.ownSDKFileSHA256&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&c.betRaw===88&&game.sg.betRaw===88&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32709 exact contract');
 assert.deepStrictEqual(b,ownDFDC32709Binding,'AG integrity: own32709 fixed next binding');assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: own32709 own BET fields');return b;
}

// Own Green Machine Bingo protocol DATA. No scheduler, replay or Mongo changes.
export type Own32839Event='BET'|'FREE_GAME'|'FEATURE_START'|'FEATURE_PICK'|'FEATURE_END';
export type Own32839State={next:{event:Own32839Event,fields:Record<string,string>}|null,eG:boolean,rj:number|null,superResult:number|null,bpl:number};
export function createOwn32839State():Own32839State{return{next:null,eG:false,rj:null,superResult:null,bpl:100};}
export function own32839Number(raw:string){assert(raw.trim()!==''&&!Number.isNaN(Number(raw)),'AG integrity: own32839 Number');return Number(raw);}
export function own32839Integer(raw:string){const n=own32839Number(raw);assert(Number.isSafeInteger(n),'AG integrity: own32839 Integer');return n;}
export function own32839Boolean(raw:string){
 const n=raw===''?null:Number(raw);if(n!==null&&!Number.isNaN(n))return n!==0;
 const s=raw.toLowerCase();if(['true','y','yes'].includes(s))return true;if(['false','n','no'].includes(s))return false;
 throw Error('AG integrity: own32839 Boolean');
}
// Own GDM Array default is Postfix: split and pop, including missing suffix.
export function own32839Postfix<T>(raw:string,delimiter:string,decode:(v:string)=>T):T[]{const a=raw.split(delimiter);a.pop();return a.map(decode);}
const own32839ResultMap:Record<number,number>={6:100,7:101,8:102,9:103,0:104,1:105,2:106,3:107,4:108,5:109};
function own32839Feature(event:'FEATURE_START'|'FEATURE_PICK'|'FEATURE_END',cfg:'0'|'1'){
 return{event,fields:{CFG:cfg,...(cfg==='0'&&event!=='FEATURE_END'?{FP:'1|1|0'}:{})}};
}
function own32839Free(s:Own32839State){return{event:'FREE_GAME' as const,fields:{BPL:String(s.bpl),LB:'1'}};}
function own32839Control(w:Record<string,string>,g:Record<string,string>){
 const nfg=w.NFG===undefined?0:own32839Integer(w.NFG),ifg=w.IFG===undefined?false:own32839Boolean(w.IFG),gct=w.GCT===undefined?false:own32839Boolean(w.GCT);
 const fid=w.FID===undefined?null:own32839Postfix(w.FID,'|',own32839Number);
 const ws=w.WS===undefined?[]:own32839Postfix(w.WS,'|',row=>own32839Postfix(row,';',own32839Number));
 const bonus=g.SBFPM===undefined?null:own32839Number(g.SBFPM);
 assert(nfg>=0,'AG integrity: own32839 negative remaining has no closed lifecycle mapping');
 return{nfg,ifg,gct,fid,ws,bonus};
}
function own32839Delegate(s:Own32839State,p:ReturnType<typeof own32839Control>){
 if(p.gct){s.next=null;return;}
 if(p.nfg!==0){s.next=own32839Free(s);return;}
 assert(p.fid===null||p.fid[0]!==0,'AG integrity: own32839 actual FID0 next unmapped');
 s.next=null;
}
export function applyOwn32839Successful(s:Own32839State,event:Own32839Event,w:Record<string,string>,g:Record<string,string>){
 assert(w.REC===undefined&&(w.R===undefined||w.R==='0'),'AG integrity: own32839 recovered response unmapped');
 assert(!(w.IFR!==undefined&&own32839Boolean(w.IFR))&&!(w.FRR!==undefined&&own32839Integer(w.FRR)>0),'AG integrity: own32839 promotional next unmapped');
 const p=own32839Control(w,g),prior=s.next;
 if(event==='BET')assert(prior===null,'AG integrity: own32839 pending round before BET');
 else assert(prior?.event===event,'AG integrity: own32839 callback response order');
 // Own J8a: only payline1 exists. BPL updates selected index or explicit Md.
 // BPR is CreditMultiplier (not Total); this own Init never assigns tt.
 if(w.BPL!==undefined){const b=own32839Integer(w.BPL);assert(b>0,'AG integrity: own32839 positive selected BPL');s.bpl=b;}
 if(w.BPR!==undefined){own32839Number(w.BPR);assert.fail('AG integrity: own32839 CreditMultiplier without baseCreditValue');}
 if(w.LB!==undefined)own32839Integer(w.LB); // J8a leaves selected line1 unchanged for an unknown option.
 if(p.ws.some(row=>row[0]===-2))s.eG=true;
 if(p.bonus!==null&&Object.prototype.hasOwnProperty.call(own32839ResultMap,p.bonus))s.rj=own32839ResultMap[p.bonus];
 if(event==='FEATURE_START'){
  if(s.rj===null){s.next=own32839Feature('FEATURE_PICK','0');return;}
  s.superResult=s.rj;
  if(!p.gct){s.next=own32839Feature('FEATURE_END','0');return;}
  s.eG=false;s.rj=null;s.superResult=null;s.next=null;return;
 }
 if(event==='FEATURE_PICK'){
  assert(s.rj!==null,'AG integrity: own32839 actual superBonus result missing');s.superResult=s.rj;
  if(!p.gct){s.next=own32839Feature('FEATURE_END','0');return;}
  s.eG=false;s.rj=null;s.superResult=null;s.next=null;return;
 }
 if(event==='FEATURE_END'){
  assert(prior?.fields.CFG==='0'||prior?.fields.CFG==='1','AG integrity: own32839 End context');
  // Both exact callbacks clear rj after the successful End, not before ACK.
  const bonusReturn=prior.fields.CFG==='0'&&s.superResult===109;
  if(prior.fields.CFG==='0')s.eG=false;
  s.rj=null;s.superResult=null;
  assert(!bonusReturn||p.gct||p.nfg>0,'AG integrity: own32839 Bonus return without mapped free request');
  assert(!s.eG,'AG integrity: own32839 pending superBonus after bingo End unmapped');
  own32839Delegate(s,p);return;
 }
 // Own Pha.Iba rebuilds features after each BET/FREE response. IFG is not latched.
 if(!p.ifg&&(s.eG||s.rj!==null)){
  if(s.rj===null){s.next=own32839Feature('FEATURE_START','0');return;}
  s.superResult=s.rj;
  if(!p.gct){s.next=own32839Feature('FEATURE_END','0');return;}
  s.eG=false;s.rj=null;s.superResult=null;s.next=null;return;
 }
 // Own bingo WZ sends CFG1 End at zero NFG even though SDK isFinal may be true.
 if(p.ifg&&p.nfg===0){s.next=own32839Feature('FEATURE_END','1');return;}
 own32839Delegate(s,p);
}
const own32839Binding={"version":"own32839-next-end-only-v1","gameId":"32839","dbName":"sg_greenmachinebingo96","runtimeGameId":33199,"runtimeSlug":"greenmachinebingo96","ownSDKFileSHA256":"b34673b20564a469357b2f8349844c46bc7ce4c77c228e49e5163aa115c8d759","ownPointProofSHA256":"65959ebe6344f34d6a7fe8ebd91c483a243f84ad334658a2f023b837c3ea4899","paidRequestParams":{"GN":"greenmachinebingo96","BPL":"100","LB":"1"},"freeSerializedFields":["BPL","LB"],"featureFields":["CFG","FP"],"fixtureProviderACKCredit":0,"missingAmountsNeverDefaulted":true,"priorIFGNeverLatched":true};
export function ownGreenMachine32839Profile(game:AGGameConfig){
 const c=game.sg?.ownGDMContract,b=c?.ownGreenMachine32839NextOnly;if(b===undefined)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32839'&&game.dbName==='sg_greenmachinebingo96'&&game.backendId==='greenmachinebingo96'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33199&&game.sg.runtimeSlug==='greenmachinebingo96','AG integrity: own32839 exact game');
 assert(c.version==='own32839-next-end-only-v1'&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===33199&&c.runtimeSlug===game.sg.runtimeSlug&&c.ownSDKFileSHA256===own32839Binding.ownSDKFileSHA256&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&c.betRaw===100&&game.sg.betRaw===100&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32839 exact contract');
 assert.deepStrictEqual(b,own32839Binding,'AG integrity: own32839 fixed next binding');assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: own32839 own BET fields');return b;
}

const own32735Protocol=(()=>{
// Private projection of this SDK's saved Ho methods. No transport, session,
// amount decoder, terminal synthesizer, source dispatch, or DB capability.
function clearHo(prior:any={}):any {
  return {...prior, Uy:false, Rp:-1, Vv:0, fw:[], BSa:-1, iC:[], nf:false,
    dh:false, Si:false}; // vK is deliberately not reset by the own literal.
}
function createModel():any {
  return {features:{By:-1, v_:null, gt:null, en:{Si:false},
    Xa:{nf:false}, ac:clearHo()}};
}
function applyFID(model:any,fid:any):any {
  // Own Dl.F4a precedes r8a/O4a. FID is JSON-decoded GSD.FID, not root FID.
  if (fid && fid.length > 0) {
    model.features.By = fid[0];
    model.features.v_ = fid[1] ? fid[1] : -1;
    if (fid[0] !== 2) model.features.Xa.nf = true;
  } else {
    model.features.en.Si = true;
    model.features.Xa.nf = false;
    model.features.ac.nf = false;
    model.features.By = -1;
    model.features.v_ = null;
    model.features.gt = null;
  }
}
function applyHoDecoded(model:any,decoded:any):any {
  const ac = model.features.ac;
  if (decoded.CFG === 2 || ac.nf) {
    if (decoded.CFG) {
      // [] remains truthy, exactly as the own indexed FTV aggregate.
      if (decoded.FTV) {
        ac.SBa = decoded.JPW;
        ac.fw = decoded.JPS;
        ac.Rp = ac.fw.length; // unavailable JPS throws, never becomes [].
        ac.nf = true;
        ac.vK = decoded.CFG;
      }
      ac.Uy = decoded.FS[decoded.CFG];
    } else if (decoded.FID && decoded.FID.some((v:any)=> v === 2)) {
      ac.nf = false;
    }
  } else {
    model.features.ac = clearHo(ac);
  }
}
function decodeSuccessControl(model:any,decoded:any):any {
  applyFID(model, decoded.FID);
  applyHoDecoded(model, decoded);
}
function constructorKind(model:any):any {
  const ac = model.features.ac;
  if (ac.nf) return ac.Uy ? ac.Vv >= ac.Rp ? 'FEATURE_END' : 'FEATURE_PICK' : 'FEATURE_START';
}
function consumePick(model:any,choice:any):any {
  const ac = model.features.ac;
  if (ac.Vv < ac.Rp) {
    ac.BSa = choice;
    ac.iC.push(choice);
    ac.Vv = ac.iC.length;
  }
}
function legalUIChoice(model:any):any {
  const chosen = model.features.ac.iC;
  // Own No=5, $r=3, wSa callback index. Deterministic UI policy only.
  const value = Array.from({length:15}, (_,i) => i).find((i:any)=> !chosen.includes(i));
  if (value === undefined) throw Error('own32735 no mapped unselected UI index');
  return value;
}
function constructFeature(model:any,callerEvent:any,choice:any):any {
  const ac = model.features.ac, kind = constructorKind(model);
  if (!kind) throw Error('own32735 Invalid Feature request.');
  const fields:any = ac.vK == null ? {} : {CFG:String(ac.vK)};
  if (kind === 'FEATURE_PICK') {
    if (!Number.isInteger(choice) || choice < 0 || choice >= 15 || ac.iC.includes(choice))
      throw Error('own32735 actual UI choice unavailable');
    fields.FP = `1|${ac.iC ? ac.iC.length+1 : 1}|${choice}`;
    consumePick(model, choice); // own pH consumes before transport, not ACK.
  }
  // Own caller/service supplies event. It is not changed to ctor kind.
  return {event:callerEvent, fields, requiresFullSessionBinder:true};
}
function successfulFeatureCallback(model:any,event:any):any {
  const ac = model.features.ac;
  if (event === 'FEATURE_START') {
    ac.Uy = true;
    return 'FEATURE_PICK';
  }
  if (event === 'FEATURE_PICK') return ac.iC.length >= ac.Rp ? 'FEATURE_END' : 'FEATURE_PICK';
  if (event === 'FEATURE_END') {
    model.features.ac = clearHo(ac);
    return {requiresOwnPostEndFreeOrOrdinaryBinder:true};
  }
  throw Error('own32735 unknown feature callback');
}

function ownHoEntryCaller(model:any):any {
  const ac = model.features.ac, started = ac.Uy;
  if (ac.dh) {
    // Actual own Jackpot.Wv -> LXa: saved choices length === Rp, unlike the
    // request ctor's Vv >= Rp. The local entry clears dh before choosing state.
    const restoredAllChoices = ac.iC.length === ac.Rp;
    ac.dh = false;
    return !started ? 'FEATURE_START' : restoredAllChoices ? 'FEATURE_END' : 'FEATURE_PICK';
  }
  return !started ? 'FEATURE_START' : 'FEATURE_PICK';
}

function createControl():any {
  return {model:createModel(), NFG:0, GCT:false, CFG:null,
    caller:undefined, afterSuccessfulEnd:false};
}
function applySuccessfulControl(control:any,event:any,decoded:any):any {
  control.NFG=decoded.NFG;
  control.GCT=decoded.GCT;
  control.CFG=decoded.CFG;
  control.afterSuccessfulEnd=false;
  decodeSuccessControl(control.model,decoded);
  control.caller=undefined;
  if (['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event)) {
    const next=successfulFeatureCallback(control.model,event);
    if (event==='FEATURE_END') control.afterSuccessfulEnd=true;
    else control.caller=next;
  } else if (control.model.features.ac.nf) {
    // One actual successful-response UI entry, not a repeated request lookup.
    control.caller=ownHoEntryCaller(control.model);
  }
}
function controlNext(control:any,actualPlatformFreePending:any=false):any {
  if (actualPlatformFreePending) throw Error('own32735 platform free request not bound');
  const model=control.model,ac=model.features.ac;
  const event=control.caller ?? (ac.nf ? ownHoEntryCaller(structuredClone(model)) : undefined);
  if (event) {
    if (!constructorKind(model)) throw Error('own32735 pending actual feature constructor unavailable');
    // The own UI never dispatches another KXa choice beyond its Rp budget.
    // A fresh entry may still name PICK when the ctor names END. Keep this
    // unsupported boundary stopped instead of silently selecting wire END.
    if (event==='FEATURE_PICK' && ac.Vv+1>ac.Rp)
      throw Error('own32735 UI pick budget does not supply an actual request');
    return {event,requiresFullSessionBinder:true};
  }
  if (control.NFG!==null && control.NFG>0 && !control.GCT)
    return {event:'FREE_GAME',requiresSelectedTotalInput:true,ownRB:5,requiresFullSessionBinder:true};
  // Actual saved PZ is positive NFG/platform free/CFG==Ho; after true END the
  // own clear+dXa callback supplies the ordinary path, unless FREE remains.
  if (control.afterSuccessfulEnd || control.GCT ||
      !(control.NFG!==null && control.NFG>0 || control.CFG===2))
    return {event:null,controlTerminalOnly:true,originalWireMoneyReplayStillRequired:true};
  throw Error('own32735 actual pending selector has no mapped next');
}
// Private request-input projection from this game's cached Ih/Wq/tbb/uM.
// It requires the actual selected-stake context; it has no transport or money
// decoder and cannot supply an INIT context or an original AG terminal.
function ownSelectedInput(sa:any):any {
  return sa.Cd
    ? sa.Cd.sc ? {type:0,value:sa.Cd.sc} : {type:1,value:sa.Cd.mj}
    : sa.$c[sa.Pd];
}

function ownNetworkSelectedInput(sa:any):any {
  // Actual common iAa -> O$ -> I$ checks presence of Cd, unlike Wq's
  // truthiness check for Cd.sc. Preserve zero/null here; never guess a stake.
  return sa.Cd!=null ? {type:0,value:sa.Cd.sc} : ownSelectedInput(sa);
}

function ownInputAsTotal(sa:any,input:any):any {
  switch (input.type) {
    case 0: return {type:0,value:input.value};
    case 1: return {type:0,value:input.value*(sa.ew[sa.bo]+(sa.m$||0))};
    case 2:
      if (sa.wp==null) throw Error('Stake type was CreditMultiplier but no baseCreditValue is present');
      return {type:0,value:input.value*sa.wp};
    default: throw Error(`Unknown stake type '${input.type}'`);
  }
}

function ownReportedStakeSelection(sa:any,reportedBPR:any):any {
  const prior=sa.Pd;
  if (reportedBPR!=null && reportedBPR!==sa.$c[prior].value) {
    for (let i=0;i<sa.$c.length;i++) {
      if (sa.$c[i].value==reportedBPR) {sa.Pd=i;return;}
    }
    throw Error('Invalid bet amount passed to server.');
  }
}

function ownFreeInputFields(model:any,sa:any):any {
  const selected=ownInputAsTotal(sa,ownNetworkSelectedInput(sa));
  // Own uM overrides the inherited constructor: No=5 and BPL/LB=null.
  // A cached paid RB=20 is not a FREE input, nor is response BPR a fallback.
  model.features.buyPass.Bva=false;
  return {BPR:selected.value,RB:5,BPL:null,LB:null};
}
// Own pH assigns request.type from Cp(model), independently of the caller's
// MFa/LFa/KFa expected response. A partial adapter cannot silently rename it.
function ownFeatureWireInput(model:any,expectedResponseEvent:any,choice:any):any {
  const wireEvent=constructorKind(model);
  if (!wireEvent || wireEvent!==expectedResponseEvent)
    throw Error('own32735 actual request type and expected successful response require mapping');
  const request=constructFeature(model,expectedResponseEvent,choice);
  return {event:wireEvent,expectedResponseEvent,fields:request.fields,
    requiresFullSessionBinder:true,requiresActualSuccessfulEnvelope:true};
}
// This game's raw control fields only. The caller must supply its actual
// parsed root and GSD records after successful-envelope/type validation.
// No session, money, terminal, transport, or DB capability is supplied here.
function own32735Integer(raw:any):any {
  if (raw.trim()==='') throw Error('own32735 Integer');
  const n=Number(raw);
  if (Number.isNaN(n)||n%1!==0) throw Error('own32735 Integer');
  return n;
}
function own32735Number(raw:any):any {
  if (raw.trim()==='') throw Error('own32735 Number');
  const n=Number(raw);
  if (Number.isNaN(n)) throw Error('own32735 Number');
  return n; // The own control codec is separate from original AG money checks.
}
function own32735Boolean(raw:any):any {
  const n=raw===''?null:Number(raw);
  if (n!==null&&!Number.isNaN(n)) return n!==0;
  const value=raw.toLowerCase();
  if (['true','y','yes'].includes(value)) return true;
  if (['false','n','no'].includes(value)) return false;
  throw Error('own32735 Boolean');
}
function own32735Optional(record:any,key:any,decode:any,fallback:any=null):any {
  if (!(key in record)) return fallback;
  try {return decode(record[key]);} catch {return null;}
}
function own32735Indexed(record:any,prefix:any,decode:any):any {
  const out:any[]=[];
  try {
    for (const key in record) {
      if (!key.startsWith(prefix)) continue;
      const suffix=key.slice(prefix.length),index=parseInt(suffix);
      // Literal d uses the parsed index's length, including negative keys.
      if (Number.isNaN(index)||suffix.slice(String(index).length)!=='') continue;
      out[index]=decode(record[key]);
    }
    return out;
  } catch {return null;} // One bad indexed value nulls the whole property.
}
const postfix=(raw:any,separator:any)=>{const rows=raw.split(separator);rows.pop();return rows;};
function decodeOwn32735RawControl(root:any,gsd:any):any {
  if (gsd==null) throw Error('own32735 actual GSD object unavailable');
  // F4a JSON.parse is after the optional String decoder; absent FID is null.
  // Do not replace it with [], nor add a seen-array/combination whitelist.
  const FID=JSON.parse(own32735Optional(gsd,'FID',(raw:any)=>raw));
  return {
    CFG:own32735Optional(root,'CFG',own32735Integer),
    NFG:own32735Optional(root,'NFG',own32735Integer,0),
    GCT:own32735Optional(root,'GCT',own32735Boolean,false),
    FID,
    FS:own32735Indexed(root,'FS_',own32735Boolean),
    FTV:own32735Indexed(root,'FTV_',(raw:any)=>postfix(raw,'|').map((row:any)=>
      postfix(row,';').map(own32735Number))),
    JPS:own32735Optional(gsd,'JPS',(raw:any)=>raw.split(';').map(own32735Integer)),
    JPW:own32735Optional(gsd,'JPW',own32735Integer),
  };
}
// The own configured network TC uses Total, not PerLine/CreditMultiplier.
// This binds a successful actual INIT menu to an explicit available choice.
// Envelope, fresh PID/Cookie, currency and original AG money stay external.
function own32735InitMenu(root:any):any {
  if (!('BD' in root)||!('BDD' in root))throw Error('own32735 actual INIT BD/BDD required');
  const values=root.BD.split('|');values.pop();
  const menu=values.map(own32735Integer),defaultValue=own32735Integer(root.BDD);
  const sa={$c:menu.map((value:any)=>({type:0,value})),eo:0,Pd:0,Vqa:0,Cd:null};
  const index=menu.lastIndexOf(defaultValue);
  if(index>=0)sa.eo=sa.Pd=index; // Native warns then selects first if absent.
  return sa;
}
function own32735SelectAvailableTotal(sa:any,selectedTotal:any):any {
  const index=sa.$c.findIndex((item:any)=>item.type===0&&item.value===selectedTotal);
  if(index<0)throw Error('own32735 requested actual INIT stake unavailable');
  sa.Pd=index;
  return sa;
}

return {clearHo,createModel,applyFID,applyHoDecoded,decodeSuccessControl,constructorKind,consumePick,legalUIChoice,constructFeature,successfulFeatureCallback,ownHoEntryCaller,createControl,applySuccessfulControl,controlNext,ownSelectedInput,ownNetworkSelectedInput,ownInputAsTotal,ownReportedStakeSelection,ownFreeInputFields,ownFeatureWireInput,own32735Integer,own32735Number,own32735Boolean,own32735Optional,own32735Indexed,decodeOwn32735RawControl,own32735InitMenu,own32735SelectAvailableTotal};
})();

export const ownSquid32735Binding={"version":"own32735-Ho-next-and-own-FREE-v1","gameId":"32735","dbName":"sg_squidgamegganbu96","runtimeGameId":33135,"runtimeSlug":"squidgamegganbu96","ownSDKFileSHA256":"23c8a70ca4e89cf21da47427f579feb6d986a1cde33694e9817d3c93eb0044dc","paidRequestParams":{"BPR":"108","GN":"squidgamegganbu96","RB":"20"},"ownFreeRB":5,"ownSelectedInputType":"actual-INIT-Total-menu","actualNewProviderACKs":0,"noSyntheticTerminal":true,"noOldPOSTReplay":true,"ownComponentSHA256":{"own32735-Ho-control-private.mjs":"259f62a77f3dbdca8e5020cb557158f13daab3bee556266a5eef4d10888eb711","own32735-selected-total-private.mjs":"5bc4df82ce7f4f71afa050c725230095d10ea8c4c26db0035c60a97699bbde0c","own32735-feature-wire-input-private.mjs":"4b0d1ccf7123dff0a46182f63b61949cf1bc62e4ef821e1fa9ed0711251c6e25","own32735-raw-control-private.mjs":"1e1dbd3357edf365cc92234ea3752e092c42dbf5ebd275d7f3bd001845f637b6","own32735-init-selection-private.mjs":"c2a53e2faf46c78b9601438d0ccbc30a5a204d80519289fb10d7b0146c652791"}};
export function ownSquid32735Profile(game:AGGameConfig){
 const c=game.sg?.ownGDMContract,b=c?.ownSquid32735NextOnly;if(b===undefined)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32735'&&game.dbName==='sg_squidgamegganbu96'&&game.backendId==='squidgamegganbu96'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33135&&game.sg.runtimeSlug==='squidgamegganbu96','AG integrity: own32735 exact game');
 assert(c.version===ownSquid32735Binding.version&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===33135&&c.runtimeSlug===game.sg.runtimeSlug&&c.ownSDKFileSHA256===ownSquid32735Binding.ownSDKFileSHA256&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'&&c.betRaw===108&&game.sg.betRaw===108&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32735 exact contract');
 assert.deepStrictEqual(b,ownSquid32735Binding,'AG integrity: own32735 fixed next binding');assert.deepStrictEqual(game.sg.requestParams,b.paidRequestParams,'AG integrity: own32735 own BET fields');return b;
}



// Private source-frame connection extension. No driver means the existing Init-only hold remains.
const ownClassicGameplayFactories=new Map<string,(session:SGGdmSession,data:any)=>any>();
const ownClassicGameplayDrivers=new WeakMap<object,any>();
const ownClassicReelstripFrames=new WeakMap<object,any>();
export function readOwnClassicGdmReelstripSource(session:object){
 const frame=ownClassicReelstripFrames.get(session);assert(frame&&ownClassicInitData.has(session),'AG integrity: own original REELSTRIP frame absent');
 return Object.freeze({read:(scope:object)=>{assert(scope===session&&ownClassicInitData.has(session)&&ownClassicReelstripFrames.get(session)===frame,'AG integrity: own REELSTRIP scope revoked');return frame;},has:(value:unknown)=>value===frame&&ownClassicInitData.has(session)&&ownClassicReelstripFrames.get(session)===frame});
}

const ownClassicGameplayRaw=new WeakMap<object,any>();
const ownClassicGameplayPending=new WeakMap<object,any>();
export function bindOwnClassicGdmGameplayDataFactory(gameId:string,factory:(session:SGGdmSession,data:any)=>any){
 assert(['32536','32727'].includes(gameId)&&typeof factory==='function'&&!ownClassicGameplayFactories.has(gameId),'AG integrity: own native gameplay factory scope/owner');
 ownClassicGameplayFactories.set(gameId,factory);return()=>{if(ownClassicGameplayFactories.get(gameId)===factory)ownClassicGameplayFactories.delete(gameId);};
}

function ownClassicInitProfile(game:AGGameConfig){
 if(game.sg?.ownClassicNativeInitDATA!=='own-classic-original-Init-only-v1')return undefined;
 const rows:any={'32536':{db:'sg_gorillagowilder',slug:'gorillagowilder',runtime:33046,SHA:'672dee8e2e1a3d269ceaf62a5d5fc3ccdcd4bd91f7f98fdb69eb1c17b94126f3'},'32727':{db:'sg_medusamegaways96',slug:'medusamegaways96',runtime:33127,SHA:'d085fe6412ea19784b71eeca244875af239a6d1c29bae0e6d0f37647ade480b6'}};
 const r=rows[game.gameId],c=game.sg.ownGDMContract;
 assert(r&&game.provider==='sg'&&game.sg.protocol==='gdm'&&game.dbName===r.db&&game.backendId===r.slug&&game.sg.runtimeSlug===r.slug&&game.sg.runtimeGameId===r.runtime,'AG integrity: own classic Init game scope');
 assert(game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&c?.ownSDKFileSHA256===r.SHA&&c.gameId===game.gameId,'AG integrity: own classic Init source scope');
 assert(Number.isSafeInteger(game.sg.betRaw)&&game.sg.betRaw>0,'AG integrity: own classic Init wager scope');return r;
}
type OwnClassicInitFrame=Readonly<{sessionScope:SGGdmSession;game:AGGameConfig;step:GDMWireStep;decoded:Record<string,string>;requestBody:string;ordinal:number;endpoint:string;response:Response;}>;
type OwnClassicInitSource=Readonly<{read(session:object):OwnClassicInitFrame;has(frame:unknown):boolean;}>;
const ownClassicInitConsumers=new Map<string,(session:SGGdmSession,source:OwnClassicInitSource)=>unknown|Promise<unknown>>();
const ownClassicInitRaw=new WeakMap<object,Omit<OwnClassicInitFrame,'decoded'>>();
const ownClassicInitPending=new WeakMap<object,OwnClassicInitFrame>();
const ownClassicInitValidated=new WeakMap<object,OwnClassicInitFrame>();
const ownClassicInitData=new WeakMap<object,unknown>();
export function bindOwnClassicGdmInitDataFactory(gameId:string,consumer:(session:SGGdmSession,source:OwnClassicInitSource)=>unknown|Promise<unknown>){
 assert(['32536','32727'].includes(gameId)&&typeof consumer==='function','AG integrity: own classic Init consumer scope');ownClassicInitConsumers.set(gameId,consumer);
 return()=>{if(ownClassicInitConsumers.get(gameId)===consumer)ownClassicInitConsumers.delete(gameId);};
}
export function readOwnClassicGdmInitData(session:object){assert(ownClassicInitValidated.has(session)&&ownClassicInitData.has(session),'AG integrity: own classic no validated Init DATA');return ownClassicInitData.get(session);}

function gdmBinding(game:AGGameConfig){
 if(OwnNOVABrowserConnection.profile(game))return game.sg.ownGDMContract;
 if(ownNOVANativeInitProfile(game))return game.sg.ownGDMContract;
 if(ownClassicInitProfile(game))return game.sg.ownGDMContract;
 const c=game.sg?.ownGDMContract;
 if(ownLockIt32724Profile(game))return c;
 if(ownSquid32735Profile(game))return c;
 if(ownGreenMachine32839Profile(game))return c;
 if(ownDFDC32709Profile(game))return c;
 if(ownTrinity32681Profile(game))return c;
 if(ownChain32476Profile(game))return c;
 assert(game.provider==='sg'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/','AG integrity: GDM source gdmBinding');
 assert(['own-SDK-ordinary-final-v1','own-SDK-ordinary-typed-final-v2','own-SDK-free-game-chain-v2','own-SDK-free-game-chain-v3','own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c?.version)&&c.gameId===game.gameId&&c.dbName===game.dbName&&c.runtimeGameId===game.sg.runtimeGameId
  &&c.runtimeSlug===game.sg.runtimeSlug&&game.backendId===c.runtimeSlug&&game.sg.requestParams?.GN===c.runtimeSlug&&c.betRaw===game.sg.betRaw&&c.fixedGitCommit==='885f862bcc04841406820a932ef14c38c7759f1d'
  &&typeof c.ownSDKFileSHA256==='string'&&/^[a-f0-9]{64}$/.test(c.ownSDKFileSHA256)
  &&Number.isSafeInteger(c.betRaw)&&c.betRaw>0&&c.balanceScale===1&&c.winScale===1,'AG integrity: GDM own rule gdmBinding');
 assert((['own-SDK-ordinary-final-v1','own-SDK-ordinary-typed-final-v2'].includes(c.version)?c.ordinaryOnly===true:c.ordinaryOnly===false&&c.freeBudgetContract?.version==='own-SDK-NFG-without-promotional-FreeRounds-v1'&&c.freeBudgetContract.gameId===game.gameId)&&c.requiresNoPreviousFeature===true&&Array.isArray(c.pendingClauses)&&c.pendingClauses.length>0
  &&c.pendingClauses[0].kind==='SDK-base-false'&&c.pendingClauses.some((q:any)=>q.kind==='fresh-ordinary-SDK-NFG'&&q.wireKey==='NFG'&&q.explicitSDKDefault==='0')
  &&c.rootInactiveFlags.map((q:any)=>q.wireKey).sort().join('|')==='GA|GCT|IFG','AG integrity: GDM own final scope');
 if(['own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
  const rule=c.freeBudgetContract,b=rule?.ownSDKFreeRequestBinding,fields=b?.fieldBindings,params=rule?.freeRequestParams;
  assert(b&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.requestFieldsFromValidatedSourceBetState===true&&b.ordinaryAPAndRECNotAssumedFreeFields===true&&b.requiresCompleteNaturalRoundBeforeAnyNative===true&&b.unmappedOtherFeaturesRemainFatal===true&&b.wholeFreeChainCoverageNotClaimed===true&&Number.isSafeInteger(b.actualPaidIntroCases)&&b.actualPaidIntroCases>0,'AG integrity: GDM own SDK prefix request scope');
  for(const k of ['SDKSelectorSHA256','NFGSetterSHA256','NFGDecoderSHA256','GCTDecoderSHA256','ownRequestConstructorSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own SDK request byte binding');
  const own32722SingleBPR=b.own32722SingleBPR===true;if(own32722SingleBPR)assert(game.gameId==='32722'&&c.ownSDKFileSHA256==='aaf96a361355bdd268bf534044222037ec8f119824a0a1e174605d36240831af','AG integrity: own32722 single BPR scope');
  assert(Array.isArray(fields)&&fields.length===(own32722SingleBPR?1:2)&&new Set(fields.map((q:any)=>q.wireKey)).size===fields.length&&params?.GN===c.runtimeSlug,'AG integrity: GDM own SDK request fields');
  const keys=fields.map((q:any)=>q.wireKey).sort().join('|');assert(own32722SingleBPR?keys==='BPR':keys==='BPL|LB'||keys==='BPR|RB','AG integrity: GDM own SDK wager request class');
  assert(Object.keys(params).sort().join('|')===['GN',...fields.map((q:any)=>q.wireKey)].sort().join('|'),'AG integrity: GDM extra free request input');
  for(const f of fields)assert(f.type?.kind==='integer'&&/^[a-f0-9]{64}$/.test(f.sourceSHA256)&&params[f.wireKey]===game.sg.requestParams[f.wireKey]&&/^[1-9]\d*$/.test(params[f.wireKey]),'AG integrity: GDM source/SDK wager field binding');
 }
 if(['own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
  const b=c.freeBudgetContract?.ownSDKReturnedCashBinding;
  assert(b?.version===(b.actualOwnCompletedNaturalCashChains!==undefined?'own-SDK-TW-total-CW-current-free-cash-natural-v2':'own-SDK-TW-total-CW-current-free-cash-v1')&&b.gameId===game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256
   &&b.totalWireKey==='TW'&&b.currentWireKey==='CW'&&b.auxiliaryFeatureCashWireKey==='FGTW'&&b.cashTotalsComeFromTWNotFGTW===true
   &&b.actualCWRequiredNoSDKFallbackUsed===true&&b.allRawCashFieldsPreserved===true&&b.noMissingCashDefault===true&&b.noFakeTerminal===true
   &&b.requiresCompleteNaturalRoundBeforeNative===true&&b.otherPendingStagesStillFatal===true&&(b.actualOwnCompletedNaturalCashChains===undefined?Number.isSafeInteger(b.actualOwnCashFailures)&&b.actualOwnCashFailures>0:b.actualOwnCashFailures===0&&Number.isSafeInteger(b.actualOwnCompletedNaturalCashChains)&&b.actualOwnCompletedNaturalCashChains>0&&/^[a-f0-9]{64}$/.test(b.ownCompletedNaturalRecordSHA256)&&Number.isSafeInteger(b.ownNaturalFeatureCurrentCashRaw)&&b.ownNaturalFeatureCurrentCashRaw>0),'AG integrity: GDM own returned cash scope');
  for(const k of ['rootResponseClassSHA256','getterDefinitionSHA256','currentPayoutCopySHA256','auxiliaryInfoSetterSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own returned cash byte binding');
  assert(Array.isArray(b.fieldBindings)&&b.fieldBindings.length===3&&b.fieldBindings.map((f:any)=>f.wireKey).sort().join('|')==='CW|FGTW|TW'
   &&b.fieldBindings.every((f:any)=>/^[a-f0-9]{64}$/.test(f.sourceSHA256)&&typeof f.property==='string'&&f.property.length>0),'AG integrity: GDM own returned cash decoders');
 }else assert(c.freeBudgetContract?.ownSDKReturnedCashBinding===undefined,'AG integrity: GDM returned cash binding outside own version');
 if(c.ownOptionalRootMetadata!==undefined){
  assert(Array.isArray(c.ownOptionalRootMetadata)&&c.ownOptionalRootMetadata.length===1,'AG integrity: GDM optional metadata scope');
  const q=c.ownOptionalRootMetadata[0];
  assert(q.schema==='own-SDK-optional-PD-metadata-v1'&&q.wireKey==='PD'&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.explicitSDKRequired===false&&q.missingSDKValue==='null'&&q.cashAndPendingDefaultsForbidden===true,'AG integrity: GDM optional metadata identity');
  assert(JSON.stringify(q.requiredCaptureKeys)===JSON.stringify(['B','AB','TW','MSGID','GA'])&&q.requiredCaptureKeys.every((k:string)=>c.requiredResponseKeys.includes(k))&&c.responseKeys.includes('PD')&&!c.requiredResponseKeys.includes('PD'),'AG integrity: GDM required cash/pending envelope');
  assert(typeof q.ownSDKProperty==='string'&&q.ownSDKProperty.length>0&&/^[a-f0-9]{64}$/.test(q.ownSDKMissingFieldFunctionSHA256)&&Array.isArray(q.ownSDKFieldDecoderSHA256s)&&q.ownSDKFieldDecoderSHA256s.length>0&&q.ownSDKFieldDecoderSHA256s.every((h:any)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM optional metadata byte proof');
 }
 return c;
}
export function ownGDMOrdinaryFinal(game:AGGameConfig,p:Record<string,string>):boolean{
 const c=gdmBinding(game),gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');
 for(const k of Object.keys(p))assert(c.responseKeys.includes(k),'AG integrity: GDM unknown response field');
 for(const k of c.requiredResponseKeys)assert(Object.prototype.hasOwnProperty.call(p,k),'AG integrity: GDM missing response field');
 ownGDMSDKTypedGSD(game,gsd);
 // These are explicit own SDK-decoded fields and defaults in this game's
 // sealed contract. Missing unspecified values are never replaced with zero.
 for(const q of c.rootInactiveFlags){const v=p[q.wireKey]===undefined?q.explicitSDKDefault:p[q.wireKey];assert(v!==undefined&&v==='0','AG integrity: GDM active or unknown own feature');}
 for(const q of c.pendingClauses){
  if(q.kind==='SDK-base-false')continue;
  if(q.kind==='fresh-ordinary-SDK-NFG'){
   const v=p[q.wireKey]===undefined?q.explicitSDKDefault:p[q.wireKey];assert(v!==undefined,'AG integrity: GDM unknown own remaining budget');if(gdmInteger(v,'own remaining budget')>0)return false;
  }else if(q.kind==='own-GSD-array-length'){
   assert(q.SDKArrayDecoderProved===true,'AG integrity: GDM own array decoder');
   if(q.groupPrefix){if(Object.keys(gsd).some(k=>k.startsWith(q.groupPrefix)))return false;}
   else{const v=gsd[q.wireKey];assert(v!==undefined||q.explicitSDKEmptyArray===true,'AG integrity: GDM missing own pending array');if(v!==undefined&&v!=='')return false;}
  }else if(q.kind==='own-GSD-positive-counter'){
   const schema=c.ownGSDDataSchema,projection=schema?.ownEffectiveMetadataObject,field=schema?.fields?.[q.wireKey];
   assert(q.wireKey==='FGRS'&&q.SDKType==='integer'&&q.SDKMissingValue==='null'&&q.noCashDefault===true&&q.positiveMeansGenuineContinuation===true&&field?.type?.kind==='integer'
    &&field.ownSDKFieldSHA256===q.SDKDecoderSHA256&&field.ownSDKProperty===q.property&&schema.ownGSDClass===q.ownGSDClass
    &&projection?.ownMetadataDeserializerSHA256===q.ownMetadataDeserializerSHA256&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256),'AG integrity: GDM own positive-counter binding');
   // Exact SDK deserializer sets absent optional FGRS to null; 0 < null is false.
   // No amount or feature result is manufactured and raw dictionary is preserved.
   const value=gsd[q.wireKey];if(value!==undefined&&gdmInteger(value,'own positive pending counter')>0)return false;
  }else if(q.kind==='own-root-fresh-ordinary-predicate'){
   const b=c.ownRootPendingBinding;
   assert(b&&JSON.stringify(q)===JSON.stringify(b)&&q.gameId===game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.noCashDefaults===true
    &&/^[a-f0-9]{64}$/.test(q.ownMetadataDeserializerSHA256)&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256)
    &&Array.isArray(q.fieldBindings)&&q.fieldBindings.map((f:any)=>f.wireKey).join('|')===q.wireKeys.join('|')&&q.fieldBindings.every((f:any)=>/^[a-f0-9]{64}$/.test(f.sourceSHA256)),'AG integrity: GDM own root pending binding');
   if(q.shape==='own-nullable-root-array-length'){
    assert(q.wireKeys.join('|')==='FID'&&q.SDKMissingValue==='null'&&q.fieldBindings.length===1&&/^[a-f0-9]{64}$/.test(q.ownArrayValidatorSHA256),'AG integrity: GDM own root array binding');
    // The sealed SDK makes an absent optional FID null, whose length is not read.
    // A present feature identifier is outside this ordinary trial scope.
    if(p.FID!==undefined&&p.FID!=='')return false;
   }else{
    assert(q.shape==='own-minus-one-pending-marker'&&q.wireKeys.join('|')==='NFG|CFGG'&&q.SDKMissingValue==='not-used-for-ordinary-marker-scope'&&q.ordinaryTrialRequiresCountersInactive===true,'AG integrity: GDM own pending marker binding');
    const n=p.NFG===undefined?null:gdmInteger(p.NFG,'own root pending marker'),played=p.CFGG===undefined?null:gdmInteger(p.CFGG,'own root played counter');
    // Actual leaf is (-1 === NFG && 0 === CFGG); no missing value is inferred.
    // This admission intentionally accepts only fresh ordinary counters.
    assert((n===null||n===0)&&(played===null||played===0),'AG integrity: GDM nonordinary own root counters');
   }
  }else throw new Error('AG integrity: GDM own pending decision not mapped');
 }
 return true;
}
export function ownGDMSDKTypedGSD(game:AGGameConfig,gsd:Record<string,string>){
 const c=gdmBinding(game),schema=c.ownGSDDataSchema;
 if(schema)assert(['own-SDK-free-game-chain-v3','own-SDK-ordinary-typed-final-v2','own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&schema.version==='own-exact-SDK-GSD-types-v1'&&schema.gameId===game.gameId&&schema.ownSDKFileSHA256===c.ownSDKFileSHA256&&schema.unknownUncompiledFieldsStillFatal===true&&schema.noCashOrNextActionDerivedFromOptionalGSD===true,'AG integrity: GDM foreign typed SDK schema');
 const projection=schema?.ownEffectiveMetadataObject;
 if(projection){
  const hashes=[projection.ownObjectCodecSHA256,projection.ownMetadataDeserializerSHA256,...projection.ownClassSourceSHA256s,...projection.emptyParentSourceSHA256s,...projection.ownObjectFieldDecoderSHA256s];
  assert(projection.schema==='own-complete-SDK-metadata-object-v1'&&projection.gameId===game.gameId&&projection.ownSDKFileSHA256===c.ownSDKFileSHA256&&projection.ownGSDClass===schema.ownGSDClass&&hashes.length>=4&&hashes.every((h:any)=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM foreign own object codec');
  for(const k of ['dictionaryNotPassedToConstructor','metadataOnlyObjectProjection','knownUnsupportedFieldsRemainFatal','rootUnknownsRemainFatal','rawDictionaryPreserved','noCashOrNextActionFromUnconsumedDictionaryFields'])assert(projection[k]===true,'AG integrity: GDM incomplete own object proof');
  assert(Array.isArray(schema.knownUnsupportedFields)&&Array.isArray(projection.effectiveFieldKeys)&&new Set(projection.effectiveFieldKeys).size===projection.effectiveFieldKeys.length&&JSON.stringify([...Object.keys(schema.fields),...schema.knownUnsupportedFields].sort())===JSON.stringify(projection.effectiveFieldKeys),'AG integrity: GDM incomplete own object metadata');
 }
 const check=(value:string,type:any,depth=0):void=>{
  assert(typeof value==='string'&&value.length<=4096&&depth<8&&!/[\x00-\x1f\x7f]/.test(value),'AG integrity: GDM typed SDK field shape');
  if(type.kind==='tuple'){
   assert(typeof type.delimiter==='string'&&type.delimiter.length===1&&Array.isArray(type.items)&&type.items.length>0&&type.items.length<=16&&JSON.stringify(type.requiredSDKPositions)===JSON.stringify(type.items.map((_:any,i:number)=>i))&&/^[a-f0-9]{64}$/.test(type.ownSDKTupleClassSHA256)&&Array.isArray(type.ownSDKPositionDecoderSHA256s)&&type.ownSDKPositionDecoderSHA256s.length===type.items.length&&type.ownSDKPositionDecoderSHA256s.every((h:any)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM unbound SDK tuple');
   if(value===''&&type.ownSDKEmptyTupleBecomesNull===true){assert(type.noMissingCashDefault===true&&/^[a-f0-9]{64}$/.test(type.ownSDKOptionalParentFieldDecoderSHA256),'AG integrity: GDM unproved optional empty SDK object');return;}
   const parts=value.split(type.delimiter);assert(parts.length===type.items.length&&parts.every(v=>v!==''),'AG integrity: GDM own SDK required tuple positions');for(let i=0;i<parts.length;i++)check(parts[i],type.items[i],depth+1);return;
  }
  if(type.kind==='array'){assert(typeof type.delimiter==='string'&&type.delimiter.length===1,'AG integrity: GDM own SDK delimiter');if(value==='')return;const items=value.split(type.delimiter);if(type.strategy!==undefined){assert(type.strategy==='SDK-postfix'&&/^[a-f0-9]{64}$/.test(type.ownSDKArrayStrategySHA256)&&value.endsWith(type.delimiter),'AG integrity: GDM own SDK postfix array');items.pop();}assert(items.length<=1024,'AG integrity: GDM typed SDK array length');for(const item of items)check(item,type.item,depth+1);return;}
  if(value===''&&depth>0&&['integer','number'].includes(type.kind)&&schema?.preserveNullableSDKArrayCells===true){assert(/^[a-f0-9]{64}$/.test(schema.nullableSDKNumberValidatorSHA256),'AG integrity: GDM nullable SDK cell proof');return;}
  if(type.kind==='string')return;
  if(type.kind==='boolean'){assert(value==='0'||value==='1','AG integrity: GDM typed SDK boolean');return;}
  assert(type.kind==='integer'||type.kind==='number','AG integrity: GDM uncompiled SDK type');
  assert(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)&&Number.isFinite(Number(value)),'AG integrity: GDM typed SDK number');
  if(type.kind==='integer')assert(!type.integerAliasValidatorUnproven&&Number.isSafeInteger(Number(value)),'AG integrity: GDM typed SDK integer');
 };
 for(const [key,value]of Object.entries(gsd)){
  const field=schema?.fields?.[key];
  if(field){assert(/^[a-f0-9]{64}$/.test(field.ownSDKFieldSHA256),'AG integrity: GDM unbound SDK field');check(value,field.type);}
  else if(projection){
   // Own GoldenFire ordinary terminal getter consumes NFG/IFG/GA/GCT;
   // CSFBS is a display object. Keep its raw dictionary value without
   // requiring its unrelated object codec to finish an ordinary round.
   const ownGoldenFireDisplay=game.gameId==='32532'&&c.ownSDKFileSHA256==='b6382ca56e7b6699838cfa368f6d70078e5e2f20728d6bcc5c9e89ee3340899b'
    &&c.version==='own-SDK-ordinary-typed-final-v2'&&c.ordinaryOnly===true&&c.requiresNoPreviousFeature===true
    &&c.SDKFinalGetterSourceSHA256==='7062d38da16e3117e985ae41630cbe94e95cd89016055546c36b348c05225376'&&key==='CSFBS';
   const ownDragonNextMetadata=game.gameId==='32497'&&c.ownSDKFileSHA256==='bd76291e2f96849387cf0dfe7edba277907947eca3b79b2a47f22126eae0fd3b'&&c.ownRootNFGFlowOnlyCapture?.own32497NextEndOnly===true&&['BGINFO','CASINFO','FGINFO'].includes(key);
   assert(!projection.effectiveFieldKeys.includes(key)||ownGoldenFireDisplay||ownDragonNextMetadata,'AG integrity: GDM known unsupported own object field');
   // This game's complete Object decoder constructs without the dictionary
   // and reads only its bound metadata. Preserve extra display metadata in
   // the raw response; never use it to derive cash or a follow-up request.
   assert(/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)&&typeof value==='string'&&value.length<=4096&&!/[\x00-\x1f\x7f]/.test(value),'AG integrity: GDM own object dictionary shape');
  }else assert(c.ordinaryGSDKeys.includes(key),'AG integrity: GDM unknown own typed GSD field');
 }
}
function ownGDMFreeEnvelope(game:AGGameConfig,p:Record<string,string>,event:string){
 const c=gdmBinding(game),rule=c.freeBudgetContract;assert(rule?.gameId===game.gameId,'AG integrity: GDM own free scope');
 for(const k of Object.keys(p))assert(c.responseKeys.includes(k),'AG integrity: GDM unknown free response field');
 for(const k of c.requiredResponseKeys)assert(p[k]!==undefined,'AG integrity: GDM missing free envelope field');
 for(const k of rule.promotionalKeysForbidden)assert(p[k]===undefined,'AG integrity: GDM promotional FreeRounds not mapped');
 assert(p.GA==='0'&&(p.GCT===undefined||p.GCT==='0'),'AG integrity: GDM other active/capped feature not mapped');
 if(['own-SDK-free-prefix-trial-v4','own-SDK-returned-cash-prefix-trial-v5','own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version))for(const f of rule.ownSDKFreeRequestBinding.fieldBindings)assert(p[f.wireKey]===undefined||p[f.wireKey]===rule.freeRequestParams[f.wireKey],'AG integrity: GDM source wager state changed before next request');
 const gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');ownGDMSDKTypedGSD(game,gsd);
 assert(c.pendingClauses[0].kind==='SDK-base-false'&&c.pendingClauses[1].kind==='fresh-ordinary-SDK-NFG','AG integrity: GDM own free inherited predicate');
 if(c.pendingClauses.length===3){
  const q=c.pendingClauses[2],schema=c.ownGSDDataSchema,f=schema?.fields?.[q.wireKey];
  assert(rule.extraOwnGSDPendingCounterMustBeInactive===true&&q.kind==='own-GSD-positive-counter'&&q.wireKey==='FGRS'&&q.SDKType==='integer'&&q.SDKMissingValue==='null'&&q.noCashDefault===true&&q.positiveMeansGenuineContinuation===true
   &&f?.type?.kind==='integer'&&f.ownSDKFieldSHA256===q.SDKDecoderSHA256&&f.ownSDKProperty===q.property&&schema.ownGSDClass===q.ownGSDClass
   &&schema.ownEffectiveMetadataObject?.ownMetadataDeserializerSHA256===q.ownMetadataDeserializerSHA256&&/^[a-f0-9]{64}$/.test(q.SDKSourceSHA256),'AG integrity: GDM own extra free predicate binding');
  assert((['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&event==='FREE_GAME')||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&event==='BET'&&p.FID==='0|1|')||gsd.FGRS===undefined||gdmInteger(gsd.FGRS,'own extra pending free counter')===0,'AG integrity: GDM extra free stage requires own mapping');
 }else assert(c.pendingClauses.length===2,'AG integrity: GDM extra pending SDK branch not mapped');
 if(event==='FREE_GAME')assert(p.IFG==='1','AG integrity: GDM genuine free marker');else assert(p.IFG===undefined||p.IFG==='0','AG integrity: GDM fresh paid marker');
}

// Own32497 WheelBonus follows only its fixed client request/ACK selectors.
const ownDragonWheelBinding:Record<string,any>={"version":"own32497-fixed-wheel-to-own-FreeSpins1-v5","gameId":"32497","ownSDKFileSHA256":"bd76291e2f96849387cf0dfe7edba277907947eca3b79b2a47f22126eae0fd3b","requestCFG":"0","pickFP":"0|1|1","startAndEndFPOmitted":true,"successfulEndACKRequired":true,"sourceHashes":{"eventNames":"2f1e2013bbf8a18c619bc16f2a6d462636f9276c31b868928b75b8e5e96b7157","ownFeatureIds":"14b8b4a723933267ca3aa5ceb08d211a6ce49a0ef23bcc2c72d1d73f591217d3","FIDField":"dfbbf8314168453578b93ce413a1b800f860a5d01f19a8d507adccb6e1b26f20","FSField":"9fb6f2a3fc22efffe1c999b123dbcd5d135e810939b2387f528f4a2f8780e6c1","CFPField":"1e0b6e603c95055b2f59602a54f1475030bc9348bb07a1781a09dc4d6764dc81","arrayDefaults":"efe5b121f853d9e6d32e305744a331c875baf2d052d6c04c84128f1a56a21dd5","postfixDecoder":"f7c70f162223dc1a4c8a1742ffc8aaf62937844ad62d4e1f5dbd0e59f27b5b68","omitOptionalNull":"4a7ccab0782ae422a7b80adeec17b230b7a10de4c5c836809ab69ab598532f62","actualFeatureState":"ef82a7bc4dece3fb9080a5c08d35ce16648ecbdb6583d89bb35bac6c4837a0a6","ownNextSelector":"03a2d26d2d25d82ea9c7f3dee0be88f57406ce1c11fd2dd7e36b7e12756da621","ownRequestMethods":"1dc42b5e6f15494f5f192abd2ffc8e1a474442d6ff61d68da8c3d545a123d7f6","ownRequestFieldMetadata":"a321537f7206e4a4ba179faf9c6c93fa7b32bd0260b36547729587009ad908e1","ownFPFieldOrder":"6cbbfb3b37acca533e339f11b1a87d495f464d949a3f09c6028358eaddbeab38","ownLiteralCallers":"d4b1f1f1c20f199079adc7207a9bce5a8d338ef963f914d78bff407df485024d","startACKCallback":"c8f2ebb8bb60ae914b261beea8ca5a82f5b796785a1a76d9bbe83cfd38d2df1d","pickACKCallback":"5dca788b82dad57ea2d3eb6305b7c880491baf7b18cea33798ed4f02b864e009","endACKCallback":"3ccbafba7dd375960eb6c85e03996eb8775346db868999e60a3951d43835a880","ownNextStateAfterACK":"0310bb7f50bb66e08c8936e2ca053c337b4aa1895799d47eb2361d1cd37dc660","ownIdleResetAndSpin":"2a587853a04af3469eb7b131fbb6d77a7db032eb722ba2aab7dce24eb0506d72","ownModelResetDefinition":"2bb1fb557e83bb5b51deca52fe8178d3c947bd3d02f4997ebddf5185e1480010","ownRuntimeSelectsIdleOverride":"392131b461bfc5abc4d735645b49edbe9816d8ee3c3990147ed9de36749b8f44","genericIdleSpinRegistration":"7567f4b99bf7ed6b368169b9a6e6a5303698676d92d5dab3f45f8d5fa6577f6a","genericIdleToPrePlay":"107550e78f61e18c365ad464525a448a40e284c11ef97a50371337bb8e5ebfa3","prePlayName":"bdc1cc28904b779074d9a64e74b7bcd539067d9775d12816b198f6f936189f75","ownFeatureDispatcher":"0310bb7f50bb66e08c8936e2ca053c337b4aa1895799d47eb2361d1cd37dc660"},"entryFIDSelector":"own-postfix-integer-array-first-element-only","sourceAbsentFSAndCFPRetainOwnSessionState":true,"laterFIDElementsPreservedRawAndNotIndependentlyMapped":true,"paidBETOwnIdleClearProved":true,"FREEEntryClearAssumed":false,"ownSelectedAndEndedStateRetained":true,"actualNPDispatcherBeforeRequestConstructor":true,"selectedNoNPDispatchWithoutSuccessfulEndRemainsUnmapped":true,"ownFreeSpins1":{"mode":1,"event":"FREE_GAME","parameters":{"GN":"dragonjinlongjinbao96","BPL":"5","LB":"50"},"CFGAndFPOmitted":true,"ownPositiveRequestPointProofSHA256":"68f760c13fce79681e8c16accad2687529d8392f7c24f9acbf4048d2c28b4f78","remainingRule":"own NFG > 0 and not own GCT; unchanged original root request/terminal path","callbackOrder":"response first FID updates selected, then real successful END callback, then own FREE selector","noFREEEntryClearAssumed":true,"unknownFirstFeatureModesStillStop":true}};
function ownDragonWheelProfile(game:AGGameConfig):boolean {
 const c=game.sg.ownGDMContract,b=c.ownRootNFGFlowOnlyCapture?.own32497WheelNext;if(!b)return false;
 assert(game.gameId==='32497'&&game.dbName==='sg_dragonjinlongjinbao96'&&game.sg.runtimeGameId===33032&&game.sg.runtimeSlug==='dragonjinlongjinbao96'&&c.ownSDKFileSHA256===ownDragonWheelBinding.ownSDKFileSHA256,'AG integrity: own32497 wheel exact scope');
 assert.deepStrictEqual(b,ownDragonWheelBinding,'AG integrity: own32497 wheel fixed client binding');return true;
}
type OwnDragonWheelRequest={event:string;parameters:Record<string,string>};
type OwnDragonWheelState={selected:boolean|null;started:boolean|null;picked:boolean|null;ended:boolean|null};
function ownDragonWheelRequest(event:string):OwnDragonWheelRequest {
 assert(['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event),'AG integrity: own32497 wheel event');
 return{event,parameters:{GN:'dragonjinlongjinbao96',CFG:'0',...(event==='FEATURE_PICK'?{FP:'0|1|1'}:{})}};
}
function ownDragonWheelWireMode(w:Record<string,string>):boolean {
 if(w.FID===undefined||w.FID==='')return false;
 // The own SDK's default integer Array uses Postfix '|', then selects xO[0].
 const values=w.FID.split('|');values.pop();assert(values.length>0,'AG integrity: own32497 wheel actual feature mode unmapped');
 const ids=values.map(value=>{assert(value.trim()!==''&&Number.isSafeInteger(Number(value)),'AG integrity: own32497 wheel actual FID integer');return Number(value);});
 assert(ids[0]===0||ids[0]===1,'AG integrity: own32497 wheel actual feature mode unmapped');return ids[0]===0;
}
export function ownDragonWheelEntry(w:Record<string,string>,s:OwnDragonWheelState,event:string):OwnDragonWheelRequest|undefined {
  // Own ZYa updates jq from the first actual FID, including clearing Wheel on
  // FreeSpins1. Its END callback follows this update; it never selects CFG1/FP.
  // Existing own NFG request/terminal and original AG cash then supply FREE.
  if(w.FID!==undefined&&w.FID!=='')s.selected=ownDragonWheelWireMode(w);
 // ZYa updates present fields only; successful callbacks then set xA/Eu/$I.
 if(s.selected){
  if(w.FS_0!==undefined)s.started=ownBundleBoolean(w.FS_0);
  if(w.CFP_0!==undefined){assert(/^-?\d+$/.test(w.CFP_0)&&Number.isSafeInteger(Number(w.CFP_0)),'AG integrity: own32497 wheel actual CFP selector');s.picked=Number(w.CFP_0)===1;}
 }
 if(['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event)){s.started=true;s.picked=event!=='FEATURE_START';s.ended=event==='FEATURE_END';}
 // Own NP dispatches before gP constructs the selected request; ended means no Wheel dispatch.
 if(s.selected&&s.started&&s.picked&&!s.ended)return ownDragonWheelRequest('FEATURE_END');
 if(s.selected&&s.started&&!s.picked&&!s.ended)return ownDragonWheelRequest('FEATURE_PICK');
 if(!s.selected||s.ended)return undefined;
 if(!s.started&&!s.picked)return ownDragonWheelRequest('FEATURE_START');
 assert.fail('AG integrity: own32497 wheel actual next unmapped without successful END');
}

const OwnNOVABrowserConnection=require('./ownNOVA-browser-DATA/connection.cjs');
const ownNOVABrowserSessions=new WeakMap<object,any>();
const ownNOVABrowserFrames=new WeakMap<object,any>();
const ownNOVABrowserPending=new WeakMap<object,any>();
const OwnNOVAInitOnlyConnection=require('./ownNOVA-init-only-DATA/connection.cjs');
const ownNOVAInitOnlySessions=new WeakMap<object,any>();
const ownNOVAInitOnlyStarted=new WeakSet<object>();
function ownNOVANativeInitProfile(game:AGGameConfig){return OwnNOVAInitOnlyConnection.profile(game);}
export function readOwnNOVAOriginalInitOnly(session:object){const port=ownNOVAInitOnlySessions.get(session);assert(port?.summary().initialized,'Own NOVA original Init-only native result absent');return port.readNativeInit();}
export class SGGdmSession{
 private readonly ownLockIt32724State=OwnLockIt32724Data.createModel();
 private ownLockIt32724InitBound=false;
 private ownLockIt32724PendingFirstStart=false;
 private ownLockIt32724PendingFirstLIL=false;
 private ownLockIt32724PickerPhase:''|'start'|'pick'|'end'='';
 private ownLockIt32724FreeMode:''|'fg'|'lil'='';
 private ownLockIt32724PickerRoundStart=Number.NaN;
 private balance=Number.NaN;private closed=false;private freeState:{total:number;played:number;remaining:number;win:number;offset:number;stageFID?:string;outer?:{total:number;played:number;remaining:number;stageFID:string}}|undefined;private roundStart=0;private totalWin=0;private freeSteps:GDMWireStep[]=[];private lastRequest:{event:string;parameters:Record<string,any>}|undefined;
 private readonly freshFreeId='Free:'+crypto.randomBytes(16).toString('hex');
 private readonly pid='gdmgcm'+this.freshFreeId;private cookies=new Map<string,string>();private ordinal=0;
 private journal:number|null=null;private journalPath:string|null=null;private gameplaySent=false;
 private readonly ownCIProfile:OwnSamuraiCIProfile|undefined;
 private readonly ownCIState=createOwnSamuraiCIState();
 private readonly ownCoinState=createCoinState();
 private readonly ownChain32476State:OwnChain32476State={};
 private readonly ownSquid32735State=(()=>{const control=own32735Protocol.createControl();control.model.features.buyPass={};return control;})();
 private ownSquid32735Stake:any;
 private readonly ownTrinity32681State=createOwn32681Control();
 private ownTrinity32681SelectedTotal=108;
 private readonly ownGreenMachine32839State=createOwn32839State();
 private readonly ownDFDC32709State=createOwn32709Control();
 private ownDFDC32709SelectedTotal=88;
 private ownDragonWheelNext:OwnDragonWheelRequest|undefined;
 private readonly ownDragonWheelState:OwnDragonWheelState={selected:null,started:null,picked:null,ended:null};
 constructor(private readonly game:AGGameConfig,private readonly transport?:GDMTransport,initialBalance?:number){gdmBinding(game);ownCoinComboProfile(game);ownDragonWheelProfile(game);this.ownCIProfile=ownSamuraiCIProfile(game);if(initialBalance!==undefined){assert(Number.isSafeInteger(initialBalance)&&initialBalance>=0);this.balance=initialBalance;}}
 private evidence(value:Record<string,unknown>){
  if(this.transport)return;
  if(this.journal===null){const dir=path.resolve(process.env.SG_EVIDENCE_DIR||'.sg-evidence');fs.mkdirSync(dir,{recursive:true});
   if(this.journalPath===null){this.journalPath=path.join(dir,`${this.game.gameId}-${process.pid}-${crypto.randomUUID()}.jsonl`);this.journal=fs.openSync(this.journalPath,'wx',0o600);}else this.journal=fs.openSync(this.journalPath,'a',0o600);}
  fs.writeSync(this.journal,JSON.stringify({...value,at:new Date().toISOString()})+'\n');fs.fsyncSync(this.journal);
  if(this.closed){fs.closeSync(this.journal);this.journal=null;}
 }
 private form(event:string,parameters:Record<string,any>){
  const ownWrapperGN=ownLockIt32724Profile(this.game)?.ownLockIt32724CommonWrapperData;
  if(ownWrapperGN){assert(parameters.GN===undefined||parameters.GN===this.game.sg.runtimeSlug,'AG integrity: own32724 wrapper game name changed');parameters={GN:this.game.sg.runtimeSlug,...parameters};}
  assert(!Object.prototype.hasOwnProperty.call(parameters,'PID')&&!Object.prototype.hasOwnProperty.call(parameters,'MSGID'),'AG integrity: GDM continuation identity belongs to own session');
  const entries={...parameters,PID:this.pid,MSGID:event};
  for(const[k,v]of Object.entries(entries))assert(/^[A-Za-z0-9_]+$/.test(k)&&typeof v==='string'&&!/[&=<\r\n]/.test(v),'AG integrity: GDM own request field');
  return Object.entries(entries).map(([k,v])=>k+'='+v).join('&');
 }
 private decode(step:GDMWireStep,event:string){
  assert(step.msgId===event&&step.methodName==='processGameMessage'&&(step.httpStatus===undefined||step.httpStatus===200),'AG integrity: GDM source exchange');
  const raw=step.responseXml;assert(typeof raw==='string'&&raw.length<(event==='REELSTRIP'&&['32489','32705','32706'].includes(this.game.gameId)&&ownLinkedPickerProfile(this.game)?524288:262144)&&!/<!DOCTYPE|<!ENTITY/i.test(raw),'AG integrity: GDM source XML');
  const r=gdmParser.parse(raw).GDMRESPONSE;assert(r&&Object.keys(r).sort().join('|')==='OGS_RC|PAYLOAD|SUCCESS'&&r.OGS_RC==='0'&&r.SUCCESS==='true'&&typeof r.PAYLOAD==='string','AG integrity: GDM successful envelope');
  assert(step.responsePayload===r.PAYLOAD,'AG integrity: GDM payload differs from original XML');const p=ownGDMFields(r.PAYLOAD);assert(p.MSGID===event,'AG integrity: GDM response event');return p;
 }
 private async exchange(event:string,parameters:Record<string,any>):Promise<GDMWireStep>{
  assert(!this.closed,'AG integrity: GDM session permanently closed');const payload=this.form(event,parameters),ordinal=++this.ordinal;
  const gameplay=event!=='INIT'&&event!=='REELSTRIP';if(gameplay)this.gameplaySent=true;
  const ownFeatureFollowup=((ownLockIt32724Profile(this.game)?.ownLockIt32724FirstStartDiagnostic==='own32724-first-start-diagnostic-v1')||ownSquid32735Profile(this.game)||ownGreenMachine32839Profile(this.game)||ownDFDC32709Profile(this.game)||ownTrinity32681Profile(this.game)||ownOriginalUFLSourceProfile(this.game)||this.ownCIProfile||ownNOVAFeatureProfile(this.game)||ownCoinComboProfile(this.game)||ownDragonWheelProfile(this.game)||ownClassicInitProfile(this.game))&&['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event);
  const context={event,ordinal,requestKind:event==='FREE_GAME'||ownFeatureFollowup||(event==='ACK'&&ownChain32476Profile(this.game))?'round-follow-up' as const:gameplay?'round-start' as const:'initialization' as const,gameplayRequestHasBeenSent:this.gameplaySent};
  if(this.transport){let step:GDMWireStep;try{step=await this.transport(event,payload);}catch{this.close();throw new SGSourceFault(gameplay?'execution-unknown':'recoverable-initialization',context);}assert(!this.closed,'AG integrity: GDM late response after permanent closure');if(step.httpStatus!==undefined&&step.httpStatus!==200){this.close();throw new SGSourceFault(gameplay?'execution-unknown':'protocol', {...context,httpStatus:step.httpStatus});}return step;}
  const operator=process.env.SG_GDM_OPERATOR_ID;assert(operator&&/^[A-Za-z0-9_-]+$/.test(operator),'AG integrity: GDM own operator configuration missing');
  const body=`<gdmRequest><clienttype>flash</clienttype><lang>en_us</lang><currency>USD</currency><mode>demo</mode><token>${gdmEscape(this.freshFreeId+'@'+operator)}</token><methodName>processGameMessage</methodName><payload>${gdmEscape(payload)}</payload></gdmRequest>`;
  this.evidence({phase:'intent',ordinal,event,payload,methodName:'processGameMessage',...(ownClassicInitProfile(this.game)||ownNOVANativeInitProfile(this.game)||OwnNOVABrowserConnection.profile(this.game)?{requestBody:body,endpoint:this.game.sg.endpoint,requestHeaders:{'Content-Type':'text/xml; charset=utf-8',...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})}}:{})});const start=Date.now();let response:Response,text:string;
  try{response=await fetch(this.game.sg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/xml; charset=utf-8',...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},body});text=await response.text();}
  catch{const fault=new SGSourceFault(this.gameplaySent?'execution-unknown':'recoverable-initialization',context);this.evidence({phase:'unknown',ordinal,event,...sourceFaultMetadata(fault)});this.close();throw fault;}
  const transient=[408,425,429,500,502,503,504].includes(response.status),fault=response.status===200?null:new SGSourceFault(this.gameplaySent?'execution-unknown':transient?'recoverable-initialization':'protocol',{...context,httpStatus:response.status,responseSHA256:crypto.createHash('sha256').update(text).digest('hex')});
  this.evidence({phase:'response',ordinal,event,httpStatus:response.status,text,...(ownNOVANativeInitProfile(this.game)||OwnNOVABrowserConnection.profile(this.game)?{responseHeaders:[...response.headers.entries()],responseSetCookie:response.headers.getSetCookie?.()||[]}:{}),...(fault?sourceFaultMetadata(fault):{})});if(fault){this.close();throw fault;}assert(!this.closed,'AG integrity: GDM late response after permanent closure');
  for(const cookie of response.headers.getSetCookie?.()||[]){const pair=cookie.split(';')[0],at=pair.indexOf('=');if(at>0)this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const r=gdmParser.parse(text).GDMRESPONSE;const step:GDMWireStep={msgId:event,methodName:'processGameMessage',requestPayload:payload,responsePayload:r?.PAYLOAD,responseXml:text,httpStatus:response.status,elapsedMs:Date.now()-start};
   if(OwnNOVABrowserConnection.profile(this.game))ownNOVABrowserFrames.set(step,Object.freeze({sessionScope:this,game:this.game,step,requestBody:body,ordinal,endpoint:this.game.sg.endpoint,response}));
   if(ownClassicInitProfile(this.game))ownClassicGameplayRaw.set(step,Object.freeze({sessionScope:this,game:this.game,step,requestBody:body,ordinal,endpoint:this.game.sg.endpoint,response}));if(event==='INIT'&&ownClassicInitProfile(this.game))ownClassicInitRaw.set(step,Object.freeze({sessionScope:this,game:this.game,step,requestBody:body,ordinal,endpoint:this.game.sg.endpoint,response}));return step;
 }

 private async ownClassicOriginalInitConnect(){
  assert(!this.closed&&!this.transport,'AG integrity: own classic Init requires original live branch');
  const consume=ownClassicInitConsumers.get(this.game.gameId);assert(consume,'AG integrity: own classic Init DATA factory not bound');
  assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: GDM live source not enabled');
  try{
   const step=await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),p=this.decode(step,'INIT');
   const raw=ownClassicInitRaw.get(step);assert(raw&&raw.sessionScope===this&&!this.closed,'AG integrity: own classic original Init association absent');
   const start=gdmInteger(p.AB,'own classic original Init AB');assert(p.B!==undefined&&gdmInteger(p.B,'own classic original Init B')===start,'AG integrity: own classic original Init account');
   this.balance=start;
   const frame:OwnClassicInitFrame=Object.freeze({...raw,decoded:Object.freeze({...p})});ownClassicInitPending.set(this,frame);
   const source:OwnClassicInitSource=Object.freeze({read:(session:object)=>{assert(session===this&&(ownClassicInitPending.get(this)===frame||ownClassicInitValidated.get(this)===frame),'AG integrity: own classic Init frame revoked');return frame;},has:(value:unknown)=>value===frame&&(ownClassicInitPending.get(this)===frame||ownClassicInitValidated.get(this)===frame)});
   const data=await consume(this,source);assert(!this.closed,'AG integrity: own classic Init closed during consumption');
   const reelStep=await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),reels=this.decode(reelStep,'REELSTRIP'),reelRaw=ownClassicGameplayRaw.get(reelStep);
   assert(!this.closed&&reelRaw&&reelRaw.sessionScope===this,'AG integrity: own classic original REELSTRIP association absent');
   ownClassicReelstripFrames.set(this,Object.freeze({...reelRaw,decoded:Object.freeze({...reels})}));
   ownClassicInitPending.delete(this);ownClassicInitValidated.set(this,frame);ownClassicInitData.set(this,data);if(['own32536-private-native-base-flow-v1','own32536-private-native-free-flow-v2','own32727-private-native-paid-real-reel-flow-v1'].includes(this.game.sg.ownNativeBaseGameplayDATA)){const factory=ownClassicGameplayFactories.get(this.game.gameId);assert(factory,'AG integrity: own native gameplay driver not registered');const driver=factory(this,data);assert(driver?.kind===this.game.sg.ownNativeBaseGameplayDATA,'AG integrity: own native gameplay driver scope');ownClassicGameplayDrivers.set(this,driver);}
  }catch(error){this.close();throw error;}
 }

 private async ownNOVAOriginalInitOnlyConnect(){
  assert(ownNOVANativeInitProfile(this.game)&&!this.closed&&!this.transport&&!ownNOVAInitOnlyStarted.has(this),'Own NOVA Init-only original one-lifecycle connection');
  assert(process.env.SG_AG_ALLOW_SOURCE==='1','Own NOVA original source not enabled');
  ownNOVAInitOnlyStarted.add(this);const port=OwnNOVAInitOnlyConnection.create(this.game);ownNOVAInitOnlySessions.set(this,port);
  try{
   let request=port.start();
   for(let n=0;n<2;n++){
    assert(request&&request.ordinal===n+1&&request.message===(n===0?'INIT':'REELSTRIP'),'Own NOVA exact original native initialization intent');
    const step=await this.exchange(request.message,{GN:this.game.sg.runtimeSlug}),decoded=this.decode(step,request.message);
    if(n===0){const available=gdmInteger(decoded.AB,'own NOVA native Init actual AB'),balance=gdmInteger(decoded.B,'own NOVA native Init actual B');assert.equal(available,balance,'Own NOVA original initial account mismatch');this.balance=balance;}
    request=port.acceptValidatedOriginalInitPayload(step.responsePayload);
   }
   assert.equal(request,null,'Own NOVA initialization-only boundary cannot dispatch gameplay');const initialized=port.readNativeInit();assert(initialized?.message==='INIT'&&initialized.player?.balance===this.balance,'Own NOVA native Init actual player account association');
  }catch(error){this.close();throw error;}
 }
 private async ownNOVABrowserOriginalConnect(){
  assert(OwnNOVABrowserConnection.profile(this.game)&&!this.closed&&!this.transport&&!ownNOVABrowserSessions.has(this),'Own NOVA full original one-lifecycle source');
  assert(process.env.SG_AG_ALLOW_SOURCE==='1','Own NOVA original source not enabled');
  const bridge=OwnNOVABrowserConnection.create(this.game,{scope:this,setOriginalBalance:(raw:number)=>{assert(!this.closed&&Number.isSafeInteger(raw)&&raw>=0);this.balance=raw;},exchangeOriginal:async(event:string,parameters:Record<string,string>,roundScope:object|null,nativeRequest:any)=>{
   assert(!this.closed&&ownNOVABrowserSessions.get(this)===bridge&&bridge.ownsNativeRequest(nativeRequest,roundScope),'Own NOVA original native source request revoked');
   const step=await this.exchange(event,parameters),decoded=this.decode(step,event),raw=ownNOVABrowserFrames.get(step);assert(!this.closed&&raw&&raw.sessionScope===this&&raw.game===this.game,'Own NOVA original raw source frame absent');
   const frame=Object.freeze({...raw,roundScope,nativeRequest,decoded:Object.freeze({...decoded})});ownNOVABrowserPending.set(this,frame);
   return Object.freeze({read:(scope:object,round:object|null)=>{assert(!this.closed&&scope===this&&round===roundScope&&ownNOVABrowserPending.get(this)===frame,'Own NOVA raw response frame revoked');return frame;},has:(value:unknown)=>!this.closed&&value===frame&&ownNOVABrowserPending.get(this)===frame});
  }});ownNOVABrowserSessions.set(this,bridge);try{await bridge.connect();}catch(error){this.close();throw error;}
 }
 async connect(){
  if(OwnNOVABrowserConnection.profile(this.game))return this.ownNOVABrowserOriginalConnect();
  if(ownNOVANativeInitProfile(this.game))return this.ownNOVAOriginalInitOnlyConnect();
  if(ownClassicInitProfile(this.game))return this.ownClassicOriginalInitConnect();
  assert(!this.closed,'AG integrity: GDM session closed');if(ownLockIt32724Profile(this.game))return this.ownLockIt32724Connect();if(this.transport&&!ownSquid32735Profile(this.game)){assert(Number.isSafeInteger(this.balance));return;}
  if(ownSquid32735Profile(this.game))return this.ownSquid32735Connect();
  assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: GDM live source not enabled');
  if(ownGreenMachine32839Profile(this.game)){try{const w=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');this.balance=gdmInteger(w.B,'own32839 initial B');assert(gdmInteger(w.AB,'own32839 initial AB')===this.balance,'AG integrity: own32839 fresh initial account');assert(w.REC===undefined&&w.FID===undefined&&(w.R===undefined||w.R==='0')&&!(w.IFG!==undefined&&own32839Boolean(w.IFG))&&(w.NFG===undefined||own32839Integer(w.NFG)===0),'AG integrity: own32839 fresh Init recovery unmapped');assert(!(w.IFR!==undefined&&own32839Boolean(w.IFR))&&!(w.FRR!==undefined&&own32839Integer(w.FRR)>0),'AG integrity: own32839 promotional Init unmapped');assert(typeof w.BD==='string'&&own32839Postfix(w.BD,'|',own32839Number).includes(100),'AG integrity: own32839 selected PerLine100 unavailable');this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');return;}catch(error){this.close();throw error;}}
  if(this.ownCIProfile){try{const p=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');this.balance=ownCIWalletInteger(p.AB,'actual initial same-account AB');assert(p.R===undefined||p.R==='0','AG integrity: Samurai CI fresh recovery unmapped');assert(p.FID===undefined&&p.CFG===undefined&&p.REC===undefined&&(p.NFG===undefined||p.NFG==='0'),'AG integrity: Samurai CI prior round at fresh Init');assert(typeof p.BD==='string'&&p.BD.split('|').some(v=>v!==''&&Number(v)===5),'AG integrity: Samurai CI own BPL5 unavailable');this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');return;}catch(error){this.close();throw error;}}
  try{const ownNOVA=this.ownNOVAAccountRequestBinding(),p=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');if(ownDFDC32709Profile(this.game)){this.ownDFDC32709State.cap=own32709Optional(p.CAP,own32709Integer);assert(!((own32709Optional(p.FRR,own32709Integer)??0)>0||own32709Optional(p.IFR,own32709Boolean,false)),'AG integrity: own32709 promotional Init unmapped');}assert(p.B!==undefined&&p.AB===p.B&&(ownNOVA||ownTrinity32681Profile(this.game)||ownDFDC32709Profile(this.game)||p.GA==='0')&&(p.IFG===undefined||p.IFG==='0')&&(p.NFG===undefined||p.NFG==='0')&&p.FID===undefined&&p.REC===undefined,'AG integrity: GDM initialization cash or recovery');if(ownNOVA){assert(p.R===undefined||p.R==='0','AG integrity: GDM own NOVA fresh recovery flag');assert(typeof p.BD==='string'&&p.BD.split('|').filter(Boolean).every((v:string)=>/^[1-9]\d*$/.test(v))&&p.BD.split('|').includes(String(ownNOVA.selectedAllowedBet)),'AG integrity: GDM own NOVA selected wager unavailable');if(ownNOVA.ownSelectedReels!==null){assert(typeof p.RBM==='string','AG integrity: GDM own NOVA selected reel multiplier missing');const values=p.RBM.split('|').filter(Boolean).map((v:string)=>gdmInteger(v,'own allowed reel multiplier'));assert(values.length>=ownNOVA.ownSelectedReels&&values[ownNOVA.ownSelectedReels-1]===ownNOVA.ownSelectedRBMMultiplier,'AG integrity: GDM own NOVA explicit reel choice unavailable');}}if(this.game.sg.ownGDMContract.freeBudgetContract)for(const k of this.game.sg.ownGDMContract.freeBudgetContract.promotionalKeysForbidden)assert(p[k]===undefined,'AG integrity: GDM promotional initialization not mapped');this.balance=gdmInteger(p.B,'initial balance');this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');}catch(e){this.close();throw e;}
 }
 getHandshakeData(){return null;}getBalance(){return this.balance/100;}getFallbackBet(){const native=ownNOVABrowserSessions.get(this);if(native)return native.stake()/100;return this.game.sg.betRaw/100;}
 getSpinParams(){if(ownLockIt32724Profile(this.game)){assert(this.ownLockIt32724InitBound,'AG integrity: own32724 actual Init required');return{...this.game.sg.requestParams,...OwnLockIt32724Data.betFields(this.ownLockIt32724State)};}return {...this.game.sg.requestParams};}getInitialRoundRequest(){const native=ownNOVABrowserSessions.get(this);if(native)return native.initial();assert(!OwnNOVABrowserConnection.profile(this.game),'Own NOVA full original connection required');assert(!ownNOVANativeInitProfile(this.game),'Own NOVA initialization-only connection has no gameplay authority');const driver=ownClassicGameplayDrivers.get(this);if(driver)return driver.getInitialRequest();assert(!ownClassicInitProfile(this.game),'AG integrity: own classic next/end graph not yet admitted');return{event:'BET',parameters:this.getSpinParams()};}
 getExactFollowUpRequest(action:string){const native=ownNOVABrowserSessions.get(this);if(native)return native.exact(action);const driver=ownClassicGameplayDrivers.get(this);if(driver){assert(driver.getExactFollowUpRequest,'AG integrity: private native exact follow-up absent');return driver.getExactFollowUpRequest(action);}if(ownLockIt32724Profile(this.game)?.ownLockIt32724FreeTerminalDiagnostic&&this.ownLockIt32724FreeMode){assert(action==='FREE_SPIN','AG integrity: own32724 selected free action');return{event:'FREE_GAME',parameters:OwnLockIt32724Data.betFields(this.ownLockIt32724State)};}if(ownLockIt32724Profile(this.game)?.ownLockIt32724PickerEndDiagnostic&&this.ownLockIt32724PickerPhase){assert(action==='FREE_SPIN','AG integrity: own32724 picker action');const phase=this.ownLockIt32724PickerPhase;return{event:phase==='start'?'FEATURE_START':phase==='pick'?'FEATURE_PICK':'FEATURE_END',parameters:phase==='pick'?{CFG:'0',FP:'1'}:{CFG:'0'}};}if(ownLockIt32724Profile(this.game)?.ownLockIt32724FirstLILDiagnostic&&this.ownLockIt32724PendingFirstLIL){assert(action==='FREE_SPIN','AG integrity: own32724 LIL next action');return{event:'FREE_GAME',parameters:OwnLockIt32724Data.betFields(this.ownLockIt32724State)};}if(ownLockIt32724Profile(this.game)?.ownLockIt32724FirstStartDiagnostic){assert(action==='FREE_SPIN'&&this.ownLockIt32724PendingFirstStart,'AG integrity: own32724 first START actual next absent');return{event:'FEATURE_START',parameters:{CFG:'0'}};}if(ownSquid32735Profile(this.game)){assert(action==='FREE_SPIN','AG integrity: own32735 next action');const next=this.ownSquid32735Request();assert(next,'AG integrity: own32735 actual next absent');return next;}if(ownGreenMachine32839Profile(this.game)){assert(action==='FREE_SPIN','AG integrity: own32839 next action');const n=this.ownGreenMachine32839Request();assert(n,'AG integrity: own32839 actual next absent');return n;}if(ownDFDC32709Profile(this.game)){assert(action==='FREE_SPIN','AG integrity: own32709 next action');const exact=this.ownDFDC32709Request();assert(exact,'AG integrity: own32709 actual next absent');return exact;}if(ownTrinity32681Profile(this.game)){assert(action==='FREE_SPIN','AG integrity: own32681 next action');const exact=this.ownTrinity32681Request();assert(exact,'AG integrity: own32681 actual next absent');return exact;}if(ownChain32476Profile(this.game)){assert(action==='FREE_SPIN'&&this.ownChain32476State.pending,'AG integrity: own32476 ACK actual next absent');return structuredClone(this.ownChain32476State.pending);}if(ownDragonWheelProfile(this.game)&&this.ownDragonWheelNext){assert(action==='FREE_SPIN','AG integrity: own32497 wheel next action');return structuredClone(this.ownDragonWheelNext);}const coin=ownCoinComboProfile(this.game);if(coin){assert(action==='FREE_SPIN'&&this.ownCoinState.next,'AG integrity: Coin Combo mapped next absent');return structuredClone(this.ownCoinState.next);}const ownOriginal=ownOriginalUFLSourceProfile(this.game);if(ownOriginal){assert(action==='FREE_SPIN','AG integrity: own original UFL next action');const exact=getOwnOriginalUFLNext(this.ownOriginalUFLState);assert(exact,'AG integrity: own original UFL next absent');return exact;}const ufl=ownUFLSourceProfile(this.game);if(ufl){assert(action==='FREE_SPIN'&&this.ownUFLPending,'AG integrity: UFL actual next absent');return{event:'FREE_GAME',parameters:{...ufl.freeRequestParams}};}if(this.ownCIProfile){assert(action==='FREE_SPIN','AG integrity: Samurai CI own next action');const exact=getOwnSamuraiCINext(this.ownCIState,this.game.sg.ownGDMContract.freeBudgetContract.freeRequestParams);assert(exact,'AG integrity: Samurai CI own next absent');return exact;}if(this.game.sg.ownGDMContract.ownRootNFGFlowOnlyCapture){if(ownNOVAFeatureProfile(this.game)){assert(action==='FREE_SPIN','AG integrity: GDM own NOVA feature next action');const exact=getOwnNOVAFeatureNext(this.ownNOVAFeatureState,this.rootFlowFreeRequest());assert(exact,'AG integrity: GDM own NOVA feature next absent');return exact;}assert(action==='FREE_SPIN'&&(this.rootFlowRemaining!==undefined&&this.rootFlowRemaining>0||this.rootFlowPendingCrossLink||this.rootFlowPendingNOVAEntry),'AG integrity: GDM own root next');return {event:'FREE_GAME',parameters:this.rootFlowFreeRequest()};}if(action==='FREE_SPIN'&&this.ownPendingFree()&&this.game.sg.ownGDMContract.freeBudgetContract)return{event:'FREE_GAME',parameters:{...this.game.sg.ownGDMContract.freeBudgetContract.freeRequestParams}};return undefined;}
 getLastGameRequest(){const native=ownNOVABrowserSessions.get(this);if(native)return native.lastRequest();return this.lastRequest;}getPickParams(){throw new Error('AG integrity: GDM own selection not mapped');}
 isRoundTerminalAction(action:string){return action==='SPIN';}
 private ownExtraStageCounter(p:Record<string,string>,prior:any){
  const c=this.game.sg.ownGDMContract,b=c.freeBudgetContract?.ownSDKExtraStageBinding,schema=c.ownGSDDataSchema;
  assert(b?.version===(c.version==='own-SDK-returned-cash-stage-reentry-trial-v8'?'own-SDK-primary-with-nested-free-counter-v3':c.version==='own-SDK-returned-cash-stage-followup-trial-v7'?'own-SDK-primary-with-nested-free-counter-v2':'own-SDK-primary-with-nested-free-counter-v1')&&b.gameId===this.game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256
   &&b.optionalBackupCountersMustBePresentTogether===true&&b.entryConsumesExactlyOnePrimarySpin===true&&b.restoreMatchesOwnSavedPrimaryCounterSnapshot===true
   &&b.sourceRootBudgetRequiredForFollowup===true&&b.noCounterDefaults===true&&b.noSyntheticTerminal===true&&b.unseenExtraStageActionStillFatal===true,'AG integrity: GDM own nested counter scope');
  if(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version))assert(b.zeroRootWithSavedPrimaryUsesOwnFreeSelector===true&&b.paidNestedIntroKeepsUnplayedPrimary===true&&b.nextResponseCounterShapeStillStrict===true&&b.noManufacturedFreeResponse===true&&b.actualClosedFollowupCases>0&&/^[a-f0-9]{64}$/.test(b.SDKLeafSelectorSHA256)&&/^[a-f0-9]{64}$/.test(b.SDKFIDSetterSHA256)&&b.SDKStageHelperSHA256.length===2&&b.SDKStageHelperSHA256.every((h:string)=>/^[a-f0-9]{64}$/.test(h)),'AG integrity: GDM own stage continuation binding');
  for(const k of ['SDKBackupSetterSHA256','SDKPendingMethodSHA256','FIDDecoderSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own nested counter byte binding');
  assert(b.ordinaryPrimaryStageFID==='1|'&&b.nestedStageFID==='0|1|'&&b.fieldBindings.length===3,'AG integrity: GDM own nested stage identity');
  for(const f of b.fieldBindings)assert(['FGRS','FGTS','CFGC'].includes(f.wireKey)&&f.type?.kind==='integer'
   &&schema.fields[f.wireKey]?.ownSDKFieldSHA256===f.sourceSHA256&&schema.fields[f.wireKey]?.ownSDKProperty===f.property,'AG integrity: GDM own nested counter decoder');
  const g=p.GSD?ownGDMFields(p.GSD,'#','~'):{},keys=['FGRS','FGTS','CFGC'],present=keys.filter(k=>g[k]!==undefined);
  assert(present.length===0||present.length===3,'AG integrity: GDM incomplete primary backup counters');
  const all=gdmInteger(p.TFG,'active free total'),played=gdmInteger(p.CFGG,'active free played'),remaining=gdmInteger(p.NFG,'active free remaining');
  assert(played+remaining===all,'AG integrity: GDM active free counter sum');
  const backup=present.length?{total:gdmInteger(g.FGTS,'saved primary total'),played:gdmInteger(g.CFGC,'saved primary played'),remaining:gdmInteger(g.FGRS,'saved primary remaining'),stageFID:b.ordinaryPrimaryStageFID}:undefined;
  if(backup)assert(backup.played+backup.remaining===backup.total,'AG integrity: GDM saved primary counter sum');
  if(!prior&&['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)){
   assert(p.FID===b.nestedStageFID&&backup&&backup.played===0&&backup.total===backup.remaining&&played===0&&all===remaining&&gdmInteger(p.FGT,'paid nested award')===all&&remaining>0,'AG integrity: GDM own paid nested intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(!prior.outer&&p.FID===b.nestedStageFID){
   assert(prior.stageFID===b.ordinaryPrimaryStageFID&&backup&&backup.total>=prior.total&&backup.played===prior.played+1
    &&backup.remaining===prior.remaining-1+backup.total-prior.total&&played===0&&all===remaining&&gdmInteger(p.FGT,'actual nested intro budget')===all&&remaining>0,'AG integrity: GDM genuine nested free intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(c.version==='own-SDK-returned-cash-stage-reentry-trial-v8'&&prior.outer&&prior.remaining===0&&p.FID===b.nestedStageFID&&played===0){
   const o=prior.outer;
   assert(b.reentryOnlyAfterInnerRemainingZero===true&&b.reentryConsumesExactlyOneSavedPrimarySpin===true&&b.ownSDKSelectorAndBackupMatchSharedReentryMechanism===true
    &&Array.isArray(b.sharedNaturalReentryPacketProofs)&&b.sharedNaturalReentryPacketProofs.length===2&&b.sharedNaturalReentryPacketProofs.every((q:any)=>/^[a-f0-9]{64}$/.test(q.packetSHA256)),'AG integrity: GDM own shared reentry binding');
   assert(o.remaining>0&&backup&&backup.total>=o.total&&backup.played===o.played+1&&backup.remaining===o.remaining-1+backup.total-o.total
    &&all===remaining&&remaining>0&&gdmInteger(p.FGT,'actual repeated inner award')===all,'AG integrity: GDM own repeated nested intro');
   return{total:all,played,remaining,stageFID:p.FID,outer:backup};
  }
  if(prior.outer&&p.FID===prior.outer.stageFID){
   const o=prior.outer,afterBoundary=['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&prior.remaining===0;assert((afterBoundary?all>=o.total&&played===o.played+1&&remaining===o.remaining-1+all-o.total:prior.remaining===1&&all===o.total&&played===o.played&&remaining===o.remaining)
    &&(!backup||(backup.total===o.total&&backup.played===o.played&&backup.remaining===o.remaining)),'AG integrity: GDM own saved primary restoration');
   return{total:all,played,remaining,stageFID:p.FID,outer:undefined};
  }
  assert(p.FID===prior.stageFID&&played===prior.played+1&&all>=prior.total&&remaining===prior.remaining-1+all-prior.total,'AG integrity: GDM own same-stage counter transition');
  if(prior.outer)assert(backup&&backup.total===prior.outer.total&&backup.played===prior.outer.played&&backup.remaining===prior.outer.remaining,'AG integrity: GDM primary counters advanced inside nested stage');
  else assert(!backup||backup.remaining===0,'AG integrity: GDM unbound saved primary counters');
  assert(remaining>0||!backup||backup.remaining===0||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&prior.outer&&p.FID===b.nestedStageFID),'AG integrity: GDM extra-stage continuation without active root budget requires own SDK selector');
  return{total:all,played,remaining,stageFID:p.FID,outer:prior.outer};
 }
 private ownPendingFree(){return !!this.freeState&&(this.freeState.remaining>0||(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(this.game.sg.ownGDMContract.version)&&!!this.freeState.outer&&this.freeState.outer.remaining>0));}

 private huffActualRequestMode:number|undefined;
 private huffActualWheelStop:number|undefined;
 private huffActualNextRequestBinding(){
  const c=this.game.sg.ownGDMContract,b=c.ownRootNFGFlowOnlyCapture?.ownHuffSourceNextRequest;
  if(!b)return undefined;
  assert(['own-Huff-source-selected-next-request-v1','own-Huff-source-caller-next-request-v2'].includes(b.version)&&this.game.gameId===b.gameId&&b.gameId==='32718'&&this.game.dbName===b.dbName&&b.dbName==='sg_huffnmorepuffhighlimit96'&&this.game.sg.runtimeGameId===b.runtimeGameId&&b.runtimeGameId===33118&&this.game.sg.runtimeSlug===b.runtimeSlug&&b.runtimeSlug==='huffnmorepuffhighlimit96'&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.ownSDKFileSHA256==='48898ee09234a8c2388358e6f1f0f760e79f18f7f9290f14b8f87e42a6ffd469','AG integrity: GDM own Huff actual request identity');
  assert(b.controlWireKey==='FID'&&b.firstFeatureModeOnly&&b.normalMode===0&&b.wheelMode===2&&b.passiveBaseMode===1&&b.ownLines==='20'&&b.ownBPL==='100'&&this.game.sg.betRaw===2000&&this.game.sg.requestParams.BPR==='100'&&this.game.sg.requestParams.RB==='5'&&b.presentFirstFIDUpdatesSourceMode&&b.absentFIDKeepsPriorSourceMode&&b.missingInitialModeDoesNotDefaultToZero&&b.unmappedActiveModeStops&&b.paidRequestUnchanged&&b.rawWirePreserved&&b.noSyntheticTerminal&&b.noOldUnknownPOSTReplay,'AG integrity: GDM own Huff actual request contract');
  assert.deepStrictEqual(b.normalFields,{BPL:'100',LB:'20',BPR:'100',RB:'5'},'AG integrity: GDM own Huff normal request fields');
  assert.deepStrictEqual(b.wheelFields,{BPL:'100',LB:'20'},'AG integrity: GDM own Huff wheel request fields');
  const expected:Record<string,string>={"actualControllerConfigurationSHA256":"a9c239914e4577bbd7bb2569bb0aad762dd19a22db61c721a70a2c045a7b9762","actualRequestOverrideSHA256":"f0d4084055e2e2f409ce2f1d90c9b20f9372f8de2611f4c3e588f7452ac6a9f9","ownNormalCallerOptionsSHA256":"5974be08b253e08da90df47a2795e1a7a7927acd53b96fc64d3c49e476b98bc0","ownCallerConstantSHA256":"01c3edef9e4a193c4077c145d0bf7f6271fc6b718492b64cb3d4cb06789a405c","ownRequestOptionsProjectionSHA256":"31137c247d82bd18f641235cba866e0046d09952aa415986352f7cde20782fa5","ownWheelRequestOptionsSHA256":"242dadb250bfe8289719cc9b287ca75f11b8162e39f410db0a4df60224b9551b","ownWheelOptionsBridgeSHA256":"03115bc705f456c1a4dcebc5015f7e01266f14335a88a79dd9d3be2b76e937df","ownWheelSubmitSHA256":"25345ebd0d03f85c253e5ef717583d4f43b9941f1c94fb48d0f4a1a068705db5","ownFIDStateProjectionSHA256":"0fa1cab6df6e0d5bd564f4f53b7db1e006df22ac962a284f21d49713a8907761","ownFeatureModesSHA256":"678529d456948187152f21582b377764875192a67f704f95e4e39d72f1bec27b","ownPaylineConfigurationSHA256":"1369293a7d5196f725060e132c186fe8358a506779834449631127792e36e875","genericInheritedRequestConstructorSHA256":"3c383c3f95b46b93a489a3add024aead9df25ebabc5343a050dd6d14a960df8f"};
  for(const[k,value]of Object.entries(expected))assert(b[k]===value,'AG integrity: GDM own Huff actual source binding');
  if(b.version==='own-Huff-source-caller-next-request-v2'){
   assert(b.sourceBaseGameMode===1&&b.wheelResultGSDKey==='WHSTOP'&&b.sourceModeUpdatesOnlyWithOwnGSD&&b.sourceWheelResultUpdatesOnlyWithOwnGSD&&b.absentOwnGSDKeepsPriorCallerState&&b.actualWheelIntroFactorySelectsProviderCaller&&b.returnedWheelResultIsLocalPresentation&&b.sourceBaseGameMayHaveRemainingNFG&&b.noObservedFIDCombinationWhitelist&&b.knownSourceModesOnly&&b.originalCashAndRawChecksUnchanged&&b.sourceNullPresentationUsesNormalCaller&&b.sourceWheelOutroClearsPresentationMode&&b.wheelIntroPredicateAloneSelectsSpecialRequest,'AG integrity: GDM own Huff source caller contract');
   const control:Record<string,string>={"ownWheelStopDecoderSHA256":"fc4f0b86c513c019befb044eb41d64fdf00d7bd2a48f121a20f6515427d867bf","ownWheelStopStateCopySHA256":"13b94a069ebe9918746b1b5fea06742c4e1dd996b7d1fb1cdbbffd8b7bdda832","ownFactoryActualWheelIntroRequiredSHA256":"3bc5d1f8b18806ee4c4fe65899b4663bbe866faef4bd1e836f75c093d0f5b42b","ownWheelIntroSourceSelectorSHA256":"b32b8d0cb6d634963bacbfeb1fcec707076fbdf9dbca5ba1237638847d0d8c99","ownZeroOrBaseModeLocalWheelPresentationSHA256":"794313f93f30df4a7d45487ea4fb93c2542c9b493994e264fdcb002a3438b35a","ownWheelOutroCallbackSHA256":"3d3e74a7d911f84f36a85ed2ebafbab34194bcc0f7d5613534d9b902164e8e65","ownWheelPresentationModeResetSHA256":"944cb487a23d6febb862e8de910476f768693726f1ca21417cea87fd653c2c12"};
   for(const[k,value]of Object.entries(control))assert(b[k]===value,'AG integrity: GDM own Huff caller source binding');
  }
  return b;
 }
 private updateHuffActualRequestMode(p:Record<string,string>,remaining:number){
  const b=this.huffActualNextRequestBinding();if(!b)return;
  const caller=b.version==='own-Huff-source-caller-next-request-v2';
  // The own Rh setter copies mode and WHSTOP only when own GSD was decoded.
  if(caller&&p.GSD!==undefined){const fields=ownGDMFields(p.GSD,'#','~');this.huffActualWheelStop=fields[b.wheelResultGSDKey]===undefined?undefined:gdmInteger(fields[b.wheelResultGSDKey],'own Huff actual wheel stop');}
  if(p.FID!==undefined&&(!caller||p.GSD!==undefined)){const fields=p.FID.split('|').filter(v=>v!=='');assert(fields.length>0,'AG integrity: GDM own Huff empty actual mode');const mode=gdmInteger(fields[0],'own Huff first FID');assert(mode===b.normalMode||mode===b.wheelMode||mode===b.passiveBaseMode,'AG integrity: GDM own Huff unmapped actual mode');this.huffActualRequestMode=mode;}
  if(!caller&&remaining>0)assert(this.huffActualRequestMode===b.normalMode||this.huffActualRequestMode===b.wheelMode,'AG integrity: GDM own Huff missing or unmapped active mode');
 }
 private quickHitSecondFeature=false;
 private quickHitNextRequestBinding(){
  const c=this.game.sg.ownGDMContract,b=c.ownRootNFGFlowOnlyCapture?.ownQuickHitFG2TNextRequest;
  if(!b)return undefined;
  assert(b.version==='own-quick-hit-FG2T-game-request-v1'&&this.game.gameId===b.gameId&&b.gameId==='32618'&&this.game.dbName===b.dbName&&b.dbName==='sg_quickhitlinkfire96'&&this.game.sg.runtimeGameId===b.runtimeGameId&&b.runtimeGameId===33073&&this.game.sg.runtimeSlug===b.runtimeSlug&&b.runtimeSlug==='quickhitlinkfire96'&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.ownSDKFileSHA256==='bf4dd809cc375858f99fd221ad8547d59c499d185a942090eab4f99e1ecbc726','AG integrity: GDM own Quick Hit next-request identity');
  assert(b.controlWireKey==='FG2T'&&b.normalLines==='30'&&b.secondFeatureLines==='60'&&b.ownBPL==='5'&&this.game.sg.requestParams.BPL===b.ownBPL&&this.game.sg.requestParams.LB===b.normalLines&&b.presentOwnGSDMissingFG2TUsesSourceDefaultFalse&&b.absentOwnGSDKeepsPriorSourceState&&b.sameOwnBPLSourceValue&&b.paidRequestUnchanged&&b.rawWirePreserved&&b.noSyntheticTerminal&&b.noOldErrorPOSTReplay,'AG integrity: GDM own Quick Hit next-request contract');
  const expected:Record<string,string>={"gameRequestConstructorSHA256":"9ffcb43a17bfb57be6e725cdeb8394343a043fe2b5f4cc065f3bf991a2e397ac","gameRequestCallerSHA256":"a483d45c6c1b6401a2556ae7afe287ab6794ae1254649418ad3859632a58b3aa","lineConstantsSHA256":"354cb1c7c908fbfab5ab7730f7e79a75ef97fde60ad59a001edb9fde4ef12738","booleanDecoderSHA256":"2c45285298f014e6c729eaf7ee3a80c092cd6b276c357203f7e3b6ad8995807b","responseStateSetterSHA256":"57040846a3030c0449265572cd32e5b2a5d0783944da00c6fabd645c301f7bae","objectDecoderSHA256":"2adbb6c5b444779555985930f88436ec61e86b4f810d921967017e6f337e9ce6","ownGSDConstructorSHA256":"7e3cc77828198c4598eef3c894baccbae34c9f50993a8fe4bbcc695353b42539","guardedStateSetterSHA256":"7c34809c03f5f122bc396d916aff427f42a5b1d096a7b9371c2bcc3d68054932"};
  for(const[k,value]of Object.entries(expected))assert(b[k]===value,'AG integrity: GDM own Quick Hit actual source binding');
  return b;
 }
 private rootFlowFreeRequest(){
  const h=this.huffActualNextRequestBinding();
  if(h){
   const caller=h.version==='own-Huff-source-caller-next-request-v2';
   assert(this.huffActualRequestMode===h.normalMode||this.huffActualRequestMode===h.wheelMode||caller&&(this.huffActualRequestMode===undefined||this.huffActualRequestMode===h.sourceBaseGameMode),'AG integrity: GDM own Huff actual next mode');
   const wheelIntro=this.huffActualRequestMode===h.wheelMode&&(!caller||!this.huffActualWheelStop);
   const parameters={GN:this.game.sg.runtimeSlug,...(wheelIntro?h.wheelFields:h.normalFields)};
   // Own WheelOutro's d_a clears presentation Pm. It does not end NFG or invent a new wire mode.
   if(caller&&!wheelIntro&&this.huffActualWheelStop!==undefined)this.huffActualRequestMode=undefined;
   return parameters;
  }
  const params={...this.game.sg.ownGDMContract.freeBudgetContract.freeRequestParams},b=this.quickHitNextRequestBinding();
  if(b){params.BPL=this.game.sg.requestParams.BPL;params.LB=this.quickHitSecondFeature?b.secondFeatureLines:b.normalLines;}
  return params;
 }
 private updateQuickHitRequestState(p:Record<string,string>){
  if(!this.quickHitNextRequestBinding()||p.GSD===undefined)return;
  const fields=ownGDMFields(p.GSD,'#','~'),value=fields.FG2T;
  assert(value===undefined||value==='0'||value==='1','AG integrity: GDM own Quick Hit FG2T boolean');
  this.quickHitSecondFeature=value==='1';
 }
 private ownOriginalUFLState=createOwnOriginalUFLState();
 private rootFlowRemaining:number|undefined;
 private rootFlowPendingCrossLink:boolean=false;private rootFlowPendingNOVAEntry=false;private ownUFLPending=false;private ownNOVAWinCapReached=false;
 private rootFlowSteps:GDMWireStep[]=[];
 private ownNOVAFeatureState=createOwnNOVAFeatureState();
 private ownNOVAAccountRequestBinding(){
  const ultra=ownQuickHitUltraAccountBinding(this.game);if(ultra)return ultra;
  const c=this.game.sg.ownGDMContract,q=c.ownRootNFGFlowOnlyCapture,r=c.freeBudgetContract,b=q?.ownNOVAAccountRequestSelection;
  if(q?.version!=='own-NOVA-account-NFG-next-end-flow-only-v4'){assert(b===undefined,'AG integrity: GDM NOVA account proof outside own scope');return undefined;}
  const registry:Record<string,any>={"32666":{"version":"own-NOVA-three-source-account-selection-v83","gameId":"32666","dbName":"sg_thewildthree","runtimeGameId":33090,"runtimeSlug":"thewildthree","ownSDKFileSHA256":"f7778c05e93e67ea364ab62727449f8909032dbaf20853073dad905db5e846ef","ownConfigFileSHA256":"32b4031b629d4d6f10da35abe043a392ffa2f891633f2039e9c3a3b744f98019","ownFixedInitSHA256":"ab5a5237cc46064bab000c500bd1c48f7c0455f3d0a26feaa8263d0fb15cded9","ownSourceSnapshotSHA256":"5a15714e0a1caee08f6b0011fecaabe025f9655f3f43e2dd71b931691b58941c","ownOriginalRecordsSHA256":"8e2617a09705e40d67f6416b7d4d98788b19c9d309a3299f665af6b98995997c","ownLegacyRequestParamsSHA256":"cfec1fb09bfa1548ee576dcc7740b88cbf115f575ce39f86c592e2090f579e48","ownFutureRequestParamsSHA256":"f2ad49c0de460cdd577efbcf401b3c85d16b3c3205ff4982dfe78964fa8d9bc3","futureRequestParams":{"GN":"thewildthree","BPL":"5","LB":"10","ABPM":"0"},"betRaw":50,"selectedAllowedBet":5,"selectedBetWireKey":"BPL","explicitNewSelectionNotClaimedAsDefault":false,"futureRequestNotClaimedAsPreviouslyCaptured":true,"freshInitAllowedBetRequired":true,"freshRecoveryForbidden":true,"ownSelectedReels":null,"ownSelectedRBMMultiplier":null,"ownFixedFreshLines":10,"ownAnteBetAdjustment":0,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"originalBAndTWCashRequired":true,"noDisplayCashOrCountEquations":true,"legacyRawPacketsUnchanged":true,"paidEntryWireKey":"FGT","paidEntryPositiveSelectsOneFreeRequest":true,"paidEntryPendingIsNotSyntheticNFG":true,"followupRemainingWireKey":"NFG","terminalRemaining":0,"followupEndFreeSourceTrue":true,"ownUnmappedTerminalGSDKeys":["MSCE","MWI"],"sourceHashes":{"InitState":"343df3c884f9f3e3da6e674ebd5a3747d12540f53f90ef72b8d8852d144e8f87","BaseSpinningStartState":"abfe406af612b016cb9528350f44fe97260037c87f4a6fe2672006c08c196253","BaseWinState":"9acb041f4ebb08a1b3986cdaca50646db0cc82118a5a3b236f127c0571817b62","FreeGameSpinningStartState":"ea5b49299f9fac923b0f08d6cf6ac32f1cd986ec6b106758857e49f08a945b96","FreeGameIdleState":"c04fa7b00652434d266523c143d658a3b6efe68d184e00cb0286a100c7faba14","FreeGameWinState":"ebc797cd0fd25ccafa0a9a6c138076740459db2ded6919ecd618571076265771"},"NFGDecoderSHA256":"f4658de4bc35abfc01b476dabaea01ef640d8082f93480317d5f9b622097a762","FGTDecoderSHA256":"1b5d4e8108f73dec54bbc085e62ce6244b57e7a46fe868d8d8c3b266bda76a8e","rawWirePreserved":true,"noSyntheticTerminal":true},"32588":{"version":"own-NOVA-three-source-account-selection-v83","gameId":"32588","dbName":"sg_merlinsmoneyburst95","runtimeGameId":33063,"runtimeSlug":"merlinsmoneyburst95","ownSDKFileSHA256":"9b004739e96be29c36d3cc8a61cebf2d3062ea93eeb13fff970db41eab7afeb1","ownConfigFileSHA256":"f69d7ef68716d56cc5a2d49e91cdce350ade2da419272e574c86c32d36f61d76","ownFixedInitSHA256":"f273d24edebd72ecbcec99b3df696676c518e0a72e0c22c71bdf3c8d0e0a2d8c","ownSourceSnapshotSHA256":"7aa6dadc91f58efffa56776e62ee87e24abe5d5e6b18e5c227b006841c2d0e19","ownOriginalRecordsSHA256":"70537a056dc78b8a718d03a5558596a53d5b27b2e46104b4abe3951b3c9652a5","ownLegacyRequestParamsSHA256":"1f2530ec3683c07324ae5520155822e0801cc1dc442098399a2117cccd835acf","ownFutureRequestParamsSHA256":"44c0696c3977c294ac3ddf8d3910a48e3e2fa9097d0f403dcd68379aebde6879","futureRequestParams":{"GN":"merlinsmoneyburst95","BPL":"5","LB":"60","ABPM":"0"},"betRaw":150,"selectedAllowedBet":5,"selectedBetWireKey":"BPL","explicitNewSelectionNotClaimedAsDefault":false,"futureRequestNotClaimedAsPreviouslyCaptured":true,"freshInitAllowedBetRequired":true,"freshRecoveryForbidden":true,"ownSelectedReels":null,"ownSelectedRBMMultiplier":null,"ownFixedFreshLines":60,"ownAnteBetAdjustment":-30,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"originalBAndTWCashRequired":true,"noDisplayCashOrCountEquations":true,"legacyRawPacketsUnchanged":true,"paidEntryWireKey":"FGT","paidEntryPositiveSelectsOneFreeRequest":true,"paidEntryPendingIsNotSyntheticNFG":true,"followupRemainingWireKey":"NFG","terminalRemaining":0,"followupEndFreeSourceTrue":true,"ownUnmappedTerminalGSDKeys":[],"sourceHashes":{"InitState":"343df3c884f9f3e3da6e674ebd5a3747d12540f53f90ef72b8d8852d144e8f87","BaseSpinningStartState":"d19c75c130c081bd33560c5b9b72d2809b4d8d23ef486757e4adf555b144cd90","BaseWinState":"98b070e8822c6d8bb57ff43ac6b6b1180ef81bfe5ecea0e6c960fcec2a3ff0e0","FreeGameSpinningStartState":"84f18dc6f0b5b080ff4d987a9a6a8178bc459ca40258dec1ae156a8cfcffc608","FreeGameIdleState":"bee7cdfd824e8d30e1db89dc1529003b46aa56ca6d188c770d742e9debb9693f","FreeGameWinState":"8813e7553ff918f22c58bd7fb6dc7e9b5319307047ac5d9238ef8ccb40f11f2a"},"NFGDecoderSHA256":"f4658de4bc35abfc01b476dabaea01ef640d8082f93480317d5f9b622097a762","FGTDecoderSHA256":"1b5d4e8108f73dec54bbc085e62ce6244b57e7a46fe868d8d8c3b266bda76a8e","rawWirePreserved":true,"noSyntheticTerminal":true},"32739":{"version":"own-NOVA-three-source-account-selection-v83","gameId":"32739","dbName":"sg_thedemoncodecap250c96","runtimeGameId":33139,"runtimeSlug":"thedemoncodecap250c96","ownSDKFileSHA256":"c3327610020e409155c59cd19ff22d3aec5251f4a1f57d478d2ac80baf14295c","ownConfigFileSHA256":"ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356","ownFixedInitSHA256":"171421db5110e1b075fd3246a10b71ad018c5ccdcf3c77d5def56f48c7b34ec6","ownSourceSnapshotSHA256":"bec024b3184f3df8c72255d0d216a6979f536af80e9fe45abb418bf67bb8dfda","ownOriginalRecordsSHA256":"a2659a2ec74ca88cda34cee0636edac75f46a9f98e13f204410f487f187f22bf","ownLegacyRequestParamsSHA256":"c058a622ce2d2fa3a4336cf4cd1f41a5c8e3c0fe9e4f3e0605123648a78f0a52","ownFutureRequestParamsSHA256":"dc5c376a6f0b77c9460b7df7ecb6549751aba2d1aab951a2e65a2ba190d35700","futureRequestParams":{"GN":"thedemoncodecap250c96","BPR":"10","RB":"6"},"betRaw":100,"selectedAllowedBet":10,"selectedBetWireKey":"BPR","explicitNewSelectionNotClaimedAsDefault":true,"futureRequestNotClaimedAsPreviouslyCaptured":true,"freshInitAllowedBetRequired":true,"freshRecoveryForbidden":true,"ownSelectedReels":6,"ownSelectedRBMMultiplier":10,"ownFixedFreshLines":null,"ownAnteBetAdjustment":0,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"originalBAndTWCashRequired":true,"noDisplayCashOrCountEquations":true,"legacyRawPacketsUnchanged":true,"paidEntryWireKey":"FGT","paidEntryPositiveSelectsOneFreeRequest":true,"paidEntryPendingIsNotSyntheticNFG":true,"followupRemainingWireKey":"NFG","terminalRemaining":0,"followupEndFreeSourceTrue":true,"ownUnmappedTerminalGSDKeys":[],"sourceHashes":{"InitState":"343df3c884f9f3e3da6e674ebd5a3747d12540f53f90ef72b8d8852d144e8f87","BaseSpinningStartState":"766adc8da8f2be8da7be31ff479ddf9ad01b7f028431aca557d216217936f5eb","BaseWinState":"bfeeee21e7ab6ffbed7ba83e37ec8878234d3258727a0eead2eb6112dd93b35c","FreeGameSpinningStartState":"599afceeca47f00ed096cee501ca9ceadb4b9ef55be4c9dae8731b6f9c398119","FreeGameIdleState":"af0d8b2e4f700ea3c4a29839d07a0eee9aade756f26f54bfabead99f1e6db4a6","FreeGameWinState":"8813e7553ff918f22c58bd7fb6dc7e9b5319307047ac5d9238ef8ccb40f11f2a"},"NFGDecoderSHA256":"f4658de4bc35abfc01b476dabaea01ef640d8082f93480317d5f9b622097a762","FGTDecoderSHA256":"1b5d4e8108f73dec54bbc085e62ce6244b57e7a46fe868d8d8c3b266bda76a8e","rawWirePreserved":true,"noSyntheticTerminal":true},"32733":{"version":"own-NOVA-Rhino-Rise-source-account-selection-v85","gameId":"32733","dbName":"sg_ragingrhinorampagecap250c96","runtimeGameId":33133,"runtimeSlug":"ragingrhinorampagecap250c96","ownSDKFileSHA256":"1f7b2b35f03e6aaba2552e6ff465725342feae927301f9987963d1e1460107c2","ownConfigFileSHA256":"ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356","ownFixedInitSHA256":"c4f28c83522382362f569a8581cafc1ab465b4588d88f2b746619c452125efa6","ownSourceSnapshotSHA256":"5bb3123542f002bf5e6a23c2228ebf5fd8c277b0468f0d23d28ffd0461061c8c","ownOriginalRecordsSHA256":"3c351494f7274810178979e1cd124db2359a56d7c71d4c2723056c573c9166be","ownLegacyRequestParamsSHA256":"1fb757ad2f8e8f26c4bb2377c218c53ed95c4ce77d9c4c03f3d0257037215a47","ownFutureRequestParamsSHA256":"46f71a9f443f5a443359ccbe080a6d457896bcf932a90186855ec6b70e88fc05","futureRequestParams":{"GN":"ragingrhinorampagecap250c96","BPR":"5","RB":"6"},"betRaw":200,"selectedAllowedBet":5,"selectedBetWireKey":"BPR","explicitNewSelectionNotClaimedAsDefault":true,"futureRequestNotClaimedAsPreviouslyCaptured":true,"freshInitAllowedBetRequired":true,"freshRecoveryForbidden":true,"ownSelectedReels":6,"ownSelectedRBMMultiplier":40,"ownFixedFreshLines":null,"ownAnteBetAdjustment":null,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"originalBAndTWCashRequired":true,"noDisplayCashOrCountEquations":true,"legacyRawPacketsUnchanged":true,"paidEntryWireKey":"FGT","paidEntryPositiveSelectsOneFreeRequest":true,"paidEntryPendingIsNotSyntheticNFG":true,"followupRemainingWireKey":"NFG","terminalRemaining":0,"followupEndFreeSourceTrue":true,"ownUnmappedTerminalGSDKeys":[],"sourceHashes":{"InitState":"343df3c884f9f3e3da6e674ebd5a3747d12540f53f90ef72b8d8852d144e8f87","BaseSpinningStartState":"766adc8da8f2be8da7be31ff479ddf9ad01b7f028431aca557d216217936f5eb","BaseWinState":"bfeeee21e7ab6ffbed7ba83e37ec8878234d3258727a0eead2eb6112dd93b35c","FreeGameSpinningStartState":"599afceeca47f00ed096cee501ca9ceadb4b9ef55be4c9dae8731b6f9c398119","FreeGameIdleState":"0cad10c2db30603f410a4887412414e0f039bf2615de720eeddb49a47381b2a2","FreeGameWinState":"8813e7553ff918f22c58bd7fb6dc7e9b5319307047ac5d9238ef8ccb40f11f2a"},"NFGDecoderSHA256":"f4658de4bc35abfc01b476dabaea01ef640d8082f93480317d5f9b622097a762","FGTDecoderSHA256":"1b5d4e8108f73dec54bbc085e62ce6244b57e7a46fe868d8d8c3b266bda76a8e","rawWirePreserved":true,"noSyntheticTerminal":true,"ownExplicitSelectedLines":null,"ownUnmappedActiveGSDKeys":[],"ownIgnoreCSCWhenWinCapReached":false,"ownWinCapPositiveGSDKey":null,"ownUnmappedActiveGSDPhase":null},"32734":{"version":"own-NOVA-Rhino-Rise-source-account-selection-v85","gameId":"32734","dbName":"sg_riseofthemountainkingcap1000cbuy96","runtimeGameId":33134,"runtimeSlug":"riseofthemountainkingcap1000cbuy96","ownSDKFileSHA256":"1e903ee3ae9eb1d470592e2e74eba8ccb49b7e155fddab781378257c1d3af253","ownConfigFileSHA256":"ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356","ownFixedInitSHA256":"92ba2e407df27fac8895a262b324881252714ea663a1457f4914d2542edf3122","ownSourceSnapshotSHA256":"74ceff777ab108095d7a66d912978737b183de3d292ceabb576f5726737e2ff1","ownOriginalRecordsSHA256":"b84d2a3a7b557257b4276675ab3d9075c142677a807b9a670addd60d9754191e","ownLegacyRequestParamsSHA256":"6ecbf0671ca2e40644c2e392290320a173758d989a9e947e99263c90009b4fea","ownFutureRequestParamsSHA256":"0efe7082ad142a7d81e31145bdd55ba5addbd3e3777c7daa58c1546f98feac47","futureRequestParams":{"GN":"riseofthemountainkingcap1000cbuy96","BPL":"5","LB":"30"},"betRaw":150,"selectedAllowedBet":5,"selectedBetWireKey":"BPL","explicitNewSelectionNotClaimedAsDefault":true,"futureRequestNotClaimedAsPreviouslyCaptured":true,"freshInitAllowedBetRequired":true,"freshRecoveryForbidden":true,"ownSelectedReels":null,"ownSelectedRBMMultiplier":null,"ownFixedFreshLines":null,"ownAnteBetAdjustment":null,"optionalGADoesNotDetermineNextEnd":true,"noAutomaticGambleRequest":true,"returnedWagerDoesNotChangeAccount":true,"originalBAndTWCashRequired":true,"noDisplayCashOrCountEquations":true,"legacyRawPacketsUnchanged":true,"paidEntryWireKey":"FGT","paidEntryPositiveSelectsOneFreeRequest":true,"paidEntryPendingIsNotSyntheticNFG":true,"followupRemainingWireKey":"NFG","terminalRemaining":0,"followupEndFreeSourceTrue":true,"ownUnmappedTerminalGSDKeys":[],"sourceHashes":{"InitState":"343df3c884f9f3e3da6e674ebd5a3747d12540f53f90ef72b8d8852d144e8f87","BaseSpinningStartState":"20100e0aef3c625b0712f8562a43a6bab27fad86b74a970ee788529c30b2e0e7","BaseWinState":"bfeeee21e7ab6ffbed7ba83e37ec8878234d3258727a0eead2eb6112dd93b35c","FreeGameSpinningStartState":"536c119fc7720c8d26cee6dcaa479e3514bfd98331d331aa039101419daa33d3","FreeGameIdleState":"f8be4e9ac7da7d448273e99586df61ffd1b9c045afb559490735bd90a3843388","FreeGameWinState":"8813e7553ff918f22c58bd7fb6dc7e9b5319307047ac5d9238ef8ccb40f11f2a"},"NFGDecoderSHA256":"f4658de4bc35abfc01b476dabaea01ef640d8082f93480317d5f9b622097a762","FGTDecoderSHA256":"1b5d4e8108f73dec54bbc085e62ce6244b57e7a46fe868d8d8c3b266bda76a8e","rawWirePreserved":true,"noSyntheticTerminal":true,"ownExplicitSelectedLines":30,"ownUnmappedActiveGSDKeys":[],"ownIgnoreCSCWhenWinCapReached":true,"ownWinCapPositiveGSDKey":"CAPS","ownUnmappedActiveGSDPhase":null}},expected=registry[this.game.gameId];
  assert(expected&&this.game.dbName===expected.dbName&&this.game.sg.runtimeGameId===expected.runtimeGameId&&this.game.sg.runtimeSlug===expected.runtimeSlug&&c.ownSDKFileSHA256===expected.ownSDKFileSHA256&&c.betRaw===expected.betRaw&&c.SDKFinalGetterSourceSHA256===expected.sourceHashes.FreeGameIdleState,'AG integrity: GDM own NOVA three-game identity');
  assert.deepStrictEqual(b,expected,'AG integrity: GDM own NOVA three-game source/selection binding');
  assert.deepStrictEqual(this.game.sg.requestParams,expected.futureRequestParams,'AG integrity: GDM own NOVA paid account parameters');assert.deepStrictEqual(r.freeRequestParams,expected.futureRequestParams,'AG integrity: GDM own NOVA free account parameters');
  return b;
 }
 private rootFlowBinding(){
  const c=gdmBinding(this.game),q=c.ownRootNFGFlowOnlyCapture,r=c.freeBudgetContract,b=r?.ownSDKFreeRequestBinding;
  assert(['own-SDK-root-NFG-flow-only-v1','own-SDK-root-NFG-natural-chain-flow-only-v2','own-bundle-NFG-flow-only-v3','own-NOVA-account-NFG-next-end-flow-only-v4','own-bundle-network-feature-next-end-flow-only-v5','own-UFL-source-next-end-flow-only-v6','own-original-UFL-source-next-end-flow-v7'].includes(q?.version)&&q.gameId===this.game.gameId&&q.ownSDKFileSHA256===c.ownSDKFileSHA256&&q.SDKFinalGetterSourceSHA256===c.SDKFinalGetterSourceSHA256,'AG integrity: GDM own root flow identity');
  if(q.version==='own-SDK-root-NFG-flow-only-v1'){assert(b?.ownSDKFileSHA256===c.ownSDKFileSHA256,'AG integrity: GDM own root flow identity');for(const k of ['SDKSelectorSHA256','NFGSetterSHA256','NFGDecoderSHA256','GCTDecoderSHA256','ownRequestConstructorSHA256'])assert(q[k]===b[k],'AG integrity: GDM own root next/end selector');}
     else if(q.version==='own-bundle-NFG-flow-only-v3'){const b=q.ownBundleFlow;assert(b?.version==='own-bundle-SDK-NFG-next-end-v1'&&b.gameId===this.game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.ownTerminalSourceSHA256===c.SDKFinalGetterSourceSHA256&&b.sourceDefinedModesOnly&&b.unmappedPickAndOtherFlowStops&&b.rawWirePreserved,'AG integrity: GDM own bundle flow binding');for(const k of ['ownFreeRequestSourceSHA256','ownTerminalSourceSHA256','ownNFGDecoderSHA256','ownFeatureLookupSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own bundle SDK bytes');if(b.remainingDecoder){assert(b.remainingDecoder==='signed-minus-one-is-pending'&&b.ownNFGDecoderSHA256===crypto.createHash('sha256').update('i=void 0!==t.NFG&&-1==Number(t.NFG)?1:0').digest('hex'),'AG integrity: GDM own signed next/end decoder');}assert(Array.isArray(b.actualFreeFeatureModes)&&b.actualFreeFeatureModes.length>0&&b.actualFreeFeatureModes.every((v:any)=>Number.isSafeInteger(v)&&v>=0),'AG integrity: GDM own bundle feature selector');}
else if(q.version==='own-NOVA-account-NFG-next-end-flow-only-v4'){this.ownNOVAAccountRequestBinding();}
else if(q.version==='own-original-UFL-source-next-end-flow-v7'){assert(ownOriginalUFLSourceProfile(this.game),'AG integrity: own original UFL source scope absent');}
else if(q.version==='own-UFL-source-next-end-flow-only-v6'){assert(ownUFLSourceProfile(this.game),'AG integrity: UFL own source flow absent');}
else if(q.version==='own-bundle-network-feature-next-end-flow-only-v5'){assert(isOwnBundleFeatureProfile(ownNOVAFeatureProfile(this.game)),'AG integrity: GDM own bundle source network scope');}
else{const n=r.ownNaturalFreeRequestBinding;assert(n?.gameId===this.game.gameId&&n.ownSDKFileSHA256===c.ownSDKFileSHA256&&n.ownPaidAndFreeRequestBytesUsed&&n.noSyntheticTerminal&&n.ownCompleteNaturalRecordsSHA256===q.ownCompleteNaturalRecordsSHA256&&n.ownActualFreeRequestParamsSHA256===q.ownActualFreeRequestParamsSHA256,'AG integrity: GDM own natural request/terminal binding');const ordered=Object.fromEntries(Object.entries(r.freeRequestParams).sort(([a],[b])=>a.localeCompare(b)));assert(crypto.createHash('sha256').update(JSON.stringify(ordered)).digest('hex')===q.ownActualFreeRequestParamsSHA256&&c.pendingClauses.some((x:any)=>x.wireKey==='NFG'),'AG integrity: GDM actual natural free request');}
  assert(q.nextEvent==='FREE_GAME'&&q.remainingWireKey==='NFG'&&q.terminalRemaining===0&&q.usesOwnRequestAndTerminalOnly&&q.rawWirePreserved&&q.originalAGAmountReplayMongoChecksRequired&&q.noSyntheticTerminal&&q.noOldUnknownPOSTReplay&&q.unusedDisplayAndBudgetFieldsDoNotBlock&&q.noPreviouslySeenWholeVariationGate&&q.unmappedActiveFlagsStillStop,'AG integrity: GDM own root flow contract');
  if(q.ownCrossLinkFlow){const b=q.ownCrossLinkFlow;assert(b.version==='own-Free-to-CrossLink-next-end-v1'&&b.gameId===this.game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&b.freeMode===0&&b.crossLinkMode===1&&b.modeWireKey==='FID'&&b.remainingWireKey==='NFG'&&b.nextEvent==='FREE_GAME'&&b.sameOwnFreeRequestParameters&&b.noWireCounterInvented&&b.noGuessedFEATURE_END&&b.rawWirePreserved,'AG integrity: GDM own CrossLink flow binding');for(const k of ['ownFreeToCrossLinkSHA256','ownActualRequestSelectorSHA256','ownFirstFIDSetterSHA256','ownCrossLinkNFGSetterSHA256','ownCrossLinkEndSHA256'])assert(/^[a-f0-9]{64}$/.test(b[k]),'AG integrity: GDM own CrossLink SDK source');}
  if(q.ownNOVAOptionalGambleAvailability){
   const b=q.ownNOVAOptionalGambleAvailability;
   assert(b.version==='own-ZeusII-NOVA-optional-gamble-availability-v1'&&b.gameId===this.game.gameId&&this.game.gameId==='32748'&&b.dbName===this.game.dbName&&this.game.dbName==='sg_zeustwo96'&&b.runtimeGameId===this.game.sg.runtimeGameId&&b.runtimeGameId===33148&&b.runtimeSlug===this.game.sg.runtimeSlug&&b.runtimeSlug==='zeustwo96'&&b.ownSDKFileSHA256===c.ownSDKFileSHA256&&c.ownSDKFileSHA256==='bdd1730f21b35300ff2dceebeb6891fd9b1838155095f618d425a16d6c382e48','AG integrity: GDM own NOVA optional gamble identity');
   assert(b.availabilityWireKey==='GA'&&JSON.stringify(b.availabilityValues)==='["0","1"]'&&b.actualGambleActionRequiresUISelection&&b.optionalGambleUIOnlyShowsButton&&b.nextEndStillUsesActualNFG&&b.rawGAPreserved&&b.GAMBLE_STARTAndCOLLECTNeverAutomaticallySent,'AG integrity: GDM own NOVA optional gamble scope');
   const expected:Record<string,string>={"BaseWinStateSHA256":"bfeeee21e7ab6ffbed7ba83e37ec8878234d3258727a0eead2eb6112dd93b35c","GambleStartStateSHA256":"010e214d3d7b3d45c81680553a9f9d8979310cf06c06a09f724e70cc88048250","optionalGambleButtonOnlySHA256":"523c030d5452d79c3d0790974aede48084981bc736d26aec1a7b32134e99edfc","GADecoderSHA256":"25748d317559581250336512f70d0e8f9b8f89afc3e36834cdf54ef1676ed39d"};
   for(const[k,value]of Object.entries(expected))assert(b[k]===value,'AG integrity: GDM own NOVA optional gamble source');
  }
  if(q.ownGoldenReturnedWagerMetadata){
   const b=q.ownGoldenReturnedWagerMetadata;
   assert(this.game.gameId==='32532'&&c.ownSDKFileSHA256==='b6382ca56e7b6699838cfa368f6d70078e5e2f20728d6bcc5c9e89ee3340899b'&&b.version==='own-Golden-source-request-wager-state-v1'&&b.gameId===this.game.gameId&&b.ownSDKFileSHA256===c.ownSDKFileSHA256,'AG integrity: Golden own wager metadata identity');
   for(const k of ['SDKSelectorSHA256','NFGSetterSHA256','ownRequestConstructorSHA256'])assert(b[k]===q[k],'AG integrity: Golden own wager metadata source');
   assert(b.requestFieldsFromOwnValidatedSourceState&&b.returnedWagerFieldsDoNotChangeNextEnd&&b.actualRequestWagerFieldsStillExact&&b.rawWirePreserved,'AG integrity: Golden own wager metadata scope');
  }
  this.quickHitNextRequestBinding();
  this.huffActualNextRequestBinding();
  ownNOVAFeatureProfile(this.game);
  return {c,q,r};
 }
 private async ownSamuraiCICall(event:string,parameters:Record<string,any>|null){
  const profile=this.ownCIProfile;assert(profile&&!this.closed&&parameters,'AG integrity: Samurai CI own session');
  const c=gdmBinding(this.game),first=event==='BET';
  if(first){assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: Samurai CI actual paid request');beginOwnSamuraiCIRound(this.ownCIState);this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];}
  else{const exact=getOwnSamuraiCINext(this.ownCIState,c.freeBudgetContract.freeRequestParams);assert(exact&&exact.event===event,'AG integrity: Samurai CI actual follow-up event');assert.deepStrictEqual(parameters,exact.parameters,'AG integrity: Samurai CI actual follow-up fields');}
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const wire=this.decode(step,event);for(const key of c.freeBudgetContract.promotionalKeysForbidden)assert(wire[key]===undefined,'AG integrity: Samurai CI promotional action unmapped');
   assert(wire.REC===undefined&&(wire.R===undefined||wire.R==='0'),'AG integrity: Samurai CI recovered response unmapped');
   const amount=ownSamuraiCIWalletAmount(this.roundStart,c.betRaw,wire);
   if(step.responseBalance!==undefined)assert(step.responseBalance===amount.end,'AG integrity: Samurai CI captured actual wallet differs');
   updateOwnSamuraiCINext(profile,this.ownCIState,event,wire);
   const exact=getOwnSamuraiCINext(this.ownCIState,c.freeBudgetContract.freeRequestParams),pending=!!exact;
   this.balance=amount.end;this.totalWin=amount.win;this.rootFlowSteps.push({...step,responseBalance:amount.end});
   const steps=pending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:pending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:amount.end/100,wager:c.betRaw/100,resultAmount:amount.win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:amount.end/100,totalWin:amount.win/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:wire,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownCISamuraiActualNextEndOnly:true,ownSameAccountWalletAB:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:amount.end,betRaw:c.betRaw,totalWinRaw:amount.win}};
  }catch(error){this.close();throw error;}
 }


 private async ownOriginalUFLCall(event:string,parameters:Record<string,any>|null){
  const profile=ownOriginalUFLSourceProfile(this.game),{c}=this.rootFlowBinding(),first=event==='BET';assert(profile&&!this.closed&&parameters,'AG integrity: own original UFL session closed');
  if(first){beginOwnOriginalUFLRound(this.ownOriginalUFLState);assert.deepStrictEqual(parameters,profile.paidRequestParams);this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];}
  else {const exact=getOwnOriginalUFLNext(this.ownOriginalUFLState);assert(exact&&exact.event===event,'AG integrity: own original UFL actual next request');assert.deepStrictEqual(parameters,exact.parameters);}
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);try{
   const wire=this.decode(step,event);assert(wire.REC===undefined&&(wire.R===undefined||wire.R==='0'),'AG integrity: own original UFL recovered request unmapped');
   const end=gdmInteger(wire.B,'actual own original UFL balance'),total=gdmInteger(wire.TW,'actual own original UFL whole cash');assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===gdmInteger(wire.AB===undefined?wire.B:wire.AB,'actual own original UFL source balance'),'AG integrity: GDM source captured balance differs');
   updateOwnOriginalUFLNext(profile,this.ownOriginalUFLState,event,wire);this.balance=end;this.totalWin=total;this.rootFlowSteps.push({...step,responseBalance:end});
   const pending=!!getOwnOriginalUFLNext(this.ownOriginalUFLState),steps=pending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:pending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:wire,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownOriginalUFLActualNextEndOnly:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }

 private async ownUFLCall(event:string,parameters:Record<string,any>|null){
  const profile=ownUFLSourceProfile(this.game),{c}=this.rootFlowBinding(),first=event==='BET';
  assert(profile&&!this.closed&&parameters,'AG integrity: UFL own session closed');
  assert(first?!this.ownUFLPending:this.ownUFLPending&&event==='FREE_GAME','AG integrity: UFL actual request order');
  assert.deepStrictEqual(parameters,first?profile.paidRequestParams:profile.freeRequestParams,'AG integrity: UFL own request fields');
  if(first){this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];}this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const wire=this.decode(step,event);assert(wire.REC===undefined&&(wire.R===undefined||wire.R==='0'),'AG integrity: UFL recovered request unmapped');
   const end=gdmInteger(wire.B,'actual UFL balance'),total=gdmInteger(wire.TW,'actual UFL whole cash');
   assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===gdmInteger(wire.AB===undefined?wire.B:wire.AB,'actual UFL source balance'),'AG integrity: GDM source captured balance differs');
   this.ownUFLPending=ownUFLSourcePending(profile,wire);this.balance=end;this.totalWin=total;this.rootFlowSteps.push({...step,responseBalance:end});
   const steps=this.ownUFLPending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:this.ownUFLPending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:wire,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownUFLActualNextEndOnly:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }
 private async rootFlowCall(event:string,parameters:Record<string,any>|null){
  if(ownOriginalUFLSourceProfile(this.game))return this.ownOriginalUFLCall(event,parameters);
  if(ownUFLSourceProfile(this.game))return this.ownUFLCall(event,parameters);
  if(this.ownCIProfile)return this.ownSamuraiCICall(event,parameters);
  const {c,q,r}=this.rootFlowBinding(),first=event==='BET';assert(!this.closed&&parameters,'AG integrity: GDM own root session closed');
  const ownFeature=ownNOVAFeatureProfile(this.game),ownBundleFeature=isOwnBundleFeatureProfile(ownFeature),ownWheel=ownDragonWheelProfile(this.game),wheelAction=ownWheel&&['FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event);
  if(ownWheel&&this.ownDragonWheelNext){assert(!first&&this.ownDragonWheelNext.event===event,'AG integrity: own32497 wheel actual request order');assert.deepStrictEqual(parameters,this.ownDragonWheelNext.parameters,'AG integrity: own32497 wheel actual request fields');}
  else if(ownFeature){if(first){assert(!this.ownNOVAFeatureState.next,'AG integrity: GDM own NOVA feature pending BET');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: GDM own root request');beginOwnNOVAFeatureRound(this.ownNOVAFeatureState);}else{const exact=getOwnNOVAFeatureNext(this.ownNOVAFeatureState,this.rootFlowFreeRequest());assert(exact&&exact.event===event,'AG integrity: GDM own NOVA feature actual event');assert.deepStrictEqual(parameters,exact.parameters,'AG integrity: GDM own NOVA feature actual fields');}}else{
  assert(first?this.rootFlowRemaining===undefined&&!this.rootFlowPendingCrossLink&&!this.rootFlowPendingNOVAEntry:(this.rootFlowRemaining!==undefined&&this.rootFlowRemaining>0||this.rootFlowPendingCrossLink||this.rootFlowPendingNOVAEntry)&&event==='FREE_GAME','AG integrity: GDM actual root action');
  assert.deepStrictEqual(parameters,first?this.game.sg.requestParams:this.rootFlowFreeRequest(),'AG integrity: GDM own root request');}
  if(first){if(ownWheel){this.ownDragonWheelState.selected=null;this.ownDragonWheelState.started=null;this.ownDragonWheelState.picked=null;this.ownDragonWheelState.ended=null;}this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];this.quickHitSecondFeature=false;}this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event);assert(p.B!==undefined&&p.TW!==undefined,'AG integrity: GDM required original AG money');
   if(q.own32629NextEndOnly){assert(this.game.gameId==='32629'&&c.ownSDKFileSHA256==='6ccffa14540925e4b14b1e9f0f8158bfb1b5f72a5faabb1eab7b0dfa813aeb9a','AG integrity: own32629 next/end scope');ownGDMFreeEnvelope(this.game,p,event);gdmInteger(p.AB,'own32629 actual available balance');}
   if(q.own32716NextEndOnly){assert(this.game.gameId==='32716'&&c.ownSDKFileSHA256==='6d949797520cb4e0d2af8fc0dd33d928c11ccb88a46f320ab1916a98151d360e','AG integrity: own32716 next/end scope');gdmInteger(p.AB,'own32716 actual available balance');}
   if(q.own32497NextEndOnly){assert(this.game.gameId==='32497'&&c.ownSDKFileSHA256==='bd76291e2f96849387cf0dfe7edba277907947eca3b79b2a47f22126eae0fd3b','AG integrity: own32497 next/end scope');gdmInteger(p.AB,'own32497 actual available balance');if(ownWheel)ownDragonWheelWireMode(p);else assert(p.FID===undefined||p.FID==='','AG integrity: own32497 interactive feature next unmapped');if(wheelAction){if(p.IFG!==undefined)ownBundleBoolean(p.IFG);}else assert(first?(p.IFG===undefined||p.IFG==='0'):p.IFG==='1','AG integrity: own32497 actual free marker');ownGDMSDKTypedGSD(this.game,p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~'));}
   if(ownFeature?.kind==='linked-one-pick')gdmInteger(p.AB,'own linked picker actual available balance');
   if(q.own32722NextEndOnly){assert(this.game.gameId==='32722'&&c.ownSDKFileSHA256==='aaf96a361355bdd268bf534044222037ec8f119824a0a1e174605d36240831af'&&q.ownNestedGCTControlSHA256==='ed9bdd678b837873457ab2beb783cae80c8045d031eddce3d0a655e392b94d5a'&&q.ownNestedGCTDecoderSHA256==='2550009ca48913ac5bcfbae0c435b7b572d07b870515b50e0c89ec9cce1f1c5b','AG integrity: own32722 next/end scope');gdmInteger(p.AB,'own32722 actual available balance');const gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');assert((p.GCT===undefined||p.GCT==='0')&&(gsd.GCT===undefined||gsd.GCT==='0'),'AG integrity: own32722 actual root/nested GCT next unmapped');}
   const ownNOVA=this.ownNOVAAccountRequestBinding();assert((ownFeature?.kind==='linked-one-pick'||ownNOVA||p.GA==='0'||q.ownNOVAOptionalGambleAvailability&&p.GA==='1')&&(ownBundleFeature||p.GCT===undefined||p.GCT==='0'),'AG integrity: GDM unmapped active root flow');
   for(const k of r.promotionalKeysForbidden)if(!ownFeature||k!==ownFeature.ftvKey)assert(p[k]===undefined,'AG integrity: GDM unmapped promotional flow');
   assert(p.REC===undefined,'AG integrity: GDM recovered flow unmapped');
   if(ownNOVA)assert(p.R===undefined||p.R==='0','AG integrity: GDM own NOVA recovered response unmapped');
   if(ownNOVA){
    if(first)this.ownNOVAWinCapReached=false;
    const activeKeys=ownNOVA.ownUnmappedActiveGSDKeys??[];
    if(activeKeys.length&&event===ownNOVA.ownUnmappedActiveGSDPhase){const gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');
     if(ownNOVA.ownIgnoreCSCWhenWinCapReached&&Number(gsd[ownNOVA.ownWinCapPositiveGSDKey])>0)this.ownNOVAWinCapReached=true;
     for(const k of activeKeys)assert(gsd[k]===undefined||k==='CSC'&&ownNOVA.ownIgnoreCSCWhenWinCapReached&&this.ownNOVAWinCapReached,'AG integrity: GDM own NOVA active interactive next unmapped');
    }
   }
   if(!q.own32497NextEndOnly&&!q.ownGoldenReturnedWagerMetadata&&!q.ownBundleFlow&&!ownNOVA&&!ownBundleFeature)for(const k of Object.keys(r.freeRequestParams).filter(k=>k!=='GN'))assert(p[k]===undefined||p[k]===(q.ownQuickHitFG2TNextRequest?parameters[k]:r.freeRequestParams[k]),'AG integrity: GDM actual wager changed');
   if(q.ownHuffSourceNextRequest)for(const k of ['BPL','LB'])if(parameters[k]!==undefined)assert(p[k]===undefined||p[k]===parameters[k],'AG integrity: GDM own Huff actual request wager changed');
   let remaining:number|undefined;if(ownBundleFeature||ownNOVA&&first||ownFeature&&event!=='FREE_GAME')remaining=undefined;else if(q.ownBundleFlow?.remainingDecoder==='signed-minus-one-is-pending'){if(p.NFG===undefined&&first)remaining=0;else{assert(typeof p.NFG==='string'&&/^-?\d+$/.test(p.NFG)&&Number.isSafeInteger(Number(p.NFG))&&Number(p.NFG)>=-1,'AG integrity: GDM own signed next/end NFG');remaining=Number(p.NFG)===-1?1:0;}}else remaining=p.NFG===undefined&&(first||wheelAction)?0:gdmInteger(p.NFG,'own actual NFG');const total=gdmInteger(p.TW,'own actual total cash'),end=gdmInteger(p.B,'own actual balance');
   assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===gdmInteger(p.AB===undefined?p.B:p.AB,'own source balance'),'AG integrity: GDM source captured balance differs');
       if(q.ownBundleFlow&&p.FID!==undefined){const modes=p.FID.split('|').filter((v:string)=>v!=='').map((v:string)=>gdmInteger(v,'own bundle feature mode'));assert(modes.length>0&&modes.every((v:number)=>q.ownBundleFlow.actualFreeFeatureModes.includes(v)),'AG integrity: GDM unmapped bundle next/end');}
let pendingCrossLink=false;
   if(q.ownCrossLinkFlow){const b=q.ownCrossLinkFlow;let mode:number|undefined;if(p.FID!==undefined){const fields=p.FID.split('|').filter((v:string)=>v!=='');assert(fields.length>0,'AG integrity: GDM empty actual stage');mode=gdmInteger(fields[0],'own first feature mode');assert(mode===b.freeMode||mode===b.crossLinkMode,'AG integrity: GDM unmapped actual CrossLink mode');}if(remaining!==undefined&&remaining>0)assert(mode!==undefined,'AG integrity: GDM active feature has no stage');pendingCrossLink=remaining===0&&mode===b.freeMode;}
   if(ownWheel)this.ownDragonWheelNext=ownDragonWheelEntry(p,this.ownDragonWheelState,event);
   if(ownFeature)updateOwnNOVAFeatureNext(ownFeature,this.ownNOVAFeatureState,event,p);
   const ownFeatureExact=ownFeature?getOwnNOVAFeatureNext(this.ownNOVAFeatureState,this.rootFlowFreeRequest()):undefined;
   const pendingNOVAEntry=ownFeature?ownFeatureExact?.event==='FREE_GAME'&&!(remaining!==undefined&&remaining>0):!!ownNOVA&&first&&(p.FGT===undefined?0:gdmInteger(p.FGT,'own actual paid free entry'))>0;
   if(ownNOVA&&(ownFeature?!ownFeatureExact:!pendingNOVAEntry&&(first||remaining===0))){const gsd=p.GSD===undefined?{}:ownGDMFields(p.GSD,'#','~');for(const k of ownNOVA.ownUnmappedTerminalGSDKeys)assert(gsd[k]===undefined,'AG integrity: GDM own NOVA terminal mission flow unmapped');}
   this.updateQuickHitRequestState(p);
   this.updateHuffActualRequestMode(p,remaining);
   this.balance=end;this.totalWin=total;this.rootFlowRemaining=remaining!==undefined&&remaining>0?remaining:undefined;this.rootFlowPendingCrossLink=pendingCrossLink;this.rootFlowPendingNOVAEntry=pendingNOVAEntry;this.rootFlowSteps.push({...step,responseBalance:end});
   const pending=ownWheel&&this.ownDragonWheelNext?true:ownFeature?!!ownFeatureExact:this.rootFlowRemaining!==undefined||this.rootFlowPendingCrossLink||this.rootFlowPendingNOVAEntry,steps=pending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:pending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(s=>s.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownRootNFGNextEndOnly:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(e){this.close();throw e;}
 }


 private ownGreenMachine32839Request(){
  assert(ownGreenMachine32839Profile(this.game),'AG integrity: own32839 request scope');
  const n=this.ownGreenMachine32839State.next;return n?{event:n.event,parameters:{GN:this.game.sg.runtimeSlug,...n.fields}}:undefined;
 }
 private async ownGreenMachine32839Call(event:string,parameters:Record<string,any>|null){
  const p=ownGreenMachine32839Profile(this.game),c=gdmBinding(this.game),s=this.ownGreenMachine32839State;
  assert(p&&!this.closed&&parameters,'AG integrity: own32839 closed scope');
  if(event==='BET'){
   assert(!this.ownGreenMachine32839Request(),'AG integrity: own32839 prior actual round pending');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: own32839 own BET fields');
   this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];s.bpl=Number(parameters.BPL);
  }else{
   const n=this.ownGreenMachine32839Request();assert(n&&n.event===event,'AG integrity: own32839 actual next request order');assert.deepStrictEqual(parameters,n.parameters,'AG integrity: own32839 actual next fields');
  }
  assert(this.rootFlowSteps.length<10000,'AG integrity: own32839 finite round step bound');
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const w=this.decode(step,event),end=gdmInteger(w.B,'own32839 actual B'),available=gdmInteger(w.AB,'own32839 actual AB'),total=gdmInteger(w.TW,'own32839 actual TW');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own32839 captured account balance differs');
   assert(typeof w.GSD==='string','AG integrity: own32839 actual GSD absent');
   applyOwn32839Successful(s,event as Own32839Event,w,ownGDMFields(w.GSD,'#','~'));
   this.totalWin=total;const next=this.ownGreenMachine32839Request();if(!next)assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   this.balance=end;this.rootFlowSteps.push({...step,responseBalance:end});const steps=next?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return{NextActionInfo:{nextAction:next?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:w,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32839ActualNextOnly:true,fixtureACKNotProviderACK:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }

 private ownDFDC32709Request(){
  const p=ownDFDC32709Profile(this.game);assert(p,'AG integrity: own32709 request scope');
  const next=own32709ControlNext(this.ownDFDC32709State);if(next.event===null)return undefined;
  if(next.event==='FREE_GAME')return{event:'FREE_GAME',parameters:{GN:this.game.sg.runtimeSlug,BPR:String(this.ownDFDC32709SelectedTotal),RB:'5'}};
  const r=own32709FeatureFieldsAndConsume(structuredClone(this.ownDFDC32709State),next.event);
  return{event:r.event,parameters:{GN:this.game.sg.runtimeSlug,...r.fields}};
 }
 private async ownDFDC32709Call(event:string,parameters:Record<string,any>|null){
  const p=ownDFDC32709Profile(this.game),c=gdmBinding(this.game),s=this.ownDFDC32709State;
  assert(p&&!this.closed&&parameters,'AG integrity: own32709 closed scope');
  let requestKind:number|undefined;
  if(event==='BET'){
   assert(!this.ownDFDC32709Request(),'AG integrity: own32709 prior actual round pending');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: own32709 own BET fields');
   this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];this.ownDFDC32709SelectedTotal=Number(parameters.BPR);
  }else{
   const next=this.ownDFDC32709Request();assert(next&&next.event===event,'AG integrity: own32709 actual next request order');assert.deepStrictEqual(parameters,next.parameters,'AG integrity: own32709 actual next fields');
   if(event!=='FREE_GAME'){requestKind=own32709Pq(s);own32709FeatureFieldsAndConsume(s,event as Own32709FeatureEvent);}
  }
  assert(this.rootFlowSteps.length<10000,'AG integrity: own32709 finite round step bound');
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const w=this.decode(step,event),end=gdmInteger(w.B,'own32709 actual B'),available=gdmInteger(w.AB,'own32709 actual AB'),total=gdmInteger(w.TW,'own32709 actual TW');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own32709 captured account balance differs');
   assert(!((own32709Optional(w.FRR,own32709Integer)??0)>0||own32709Optional(w.IFR,own32709Boolean,false)),'AG integrity: own32709 platform FreeRounds request unmapped');
   assert(typeof w.GSD==='string','AG integrity: own32709 actual GSD absent');
   s.totalWin=total;applyOwn32709SuccessfulDecoded(s,event as Own32709Event,own32709DecodeControl(w,ownGDMFields(w.GSD,'#','~')),requestKind);
   this.totalWin=total;const next=this.ownDFDC32709Request();if(!next)assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   this.balance=end;this.rootFlowSteps.push({...step,responseBalance:end});const steps=next?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return{NextActionInfo:{nextAction:next?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:w,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32709ActualNextOnly:true,fixtureACKNotProviderACK:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }


 private ownSquid32735Request(){
  const profile=ownSquid32735Profile(this.game);assert(profile&&this.ownSquid32735Stake,'AG integrity: own32735 actual INIT context required');
  const next=own32735Protocol.controlNext(this.ownSquid32735State,false);if(next.event===null)return undefined;
  if(next.event==='FREE_GAME'){
   const fields=own32735Protocol.ownFreeInputFields(structuredClone(this.ownSquid32735State.model),this.ownSquid32735Stake);
   assert(Number.isSafeInteger(fields.BPR)&&fields.BPR>0,'AG integrity: own32735 actual selected input unavailable');
   return{event:next.event,parameters:{GN:this.game.sg.runtimeSlug,BPR:String(fields.BPR),RB:String(fields.RB)}};
  }
  const model=structuredClone(this.ownSquid32735State.model),choice=next.event==='FEATURE_PICK'?own32735Protocol.legalUIChoice(model):undefined;
  const request=own32735Protocol.ownFeatureWireInput(model,next.event,choice);
  return{event:request.event,parameters:{GN:this.game.sg.runtimeSlug,...request.fields}};
 }

 private async ownLockIt32724Connect(){
  assert(!this.ownLockIt32724InitBound,'AG integrity: own32724 Init already consumed');
  if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: GDM live source not enabled');
  try{const p=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');
   const start=gdmInteger(p.AB,'own32724 actual Init AB');assert(p.B!==undefined&&gdmInteger(p.B,'own32724 initial B')===start,'AG integrity: own32724 fresh actual account');
   OwnLockIt32724Data.initialize(this.ownLockIt32724State,p);this.balance=start;
   this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');this.ownLockIt32724InitBound=true;
  }catch(error){this.close();throw error;}
 }
 private async ownLockIt32724Call(event:string,parameters:Record<string,any>|null){
  const diagnostic=ownLockIt32724Profile(this.game)?.ownLockIt32724FirstStartDiagnostic==='own32724-first-start-diagnostic-v1';
  const pickerDiagnostic=ownLockIt32724Profile(this.game)?.ownLockIt32724PickerEndDiagnostic==='own32724-picker-START-PICK-END-diagnostic-v1';
  const freeDiagnostic=ownLockIt32724Profile(this.game)?.ownLockIt32724FreeTerminalDiagnostic==='own32724-selected-free-lifecycle-end-diagnostic-v1';
  if(freeDiagnostic&&this.ownLockIt32724FreeMode&&event!=='BET'){
   assert(!this.closed&&this.ownLockIt32724InitBound&&Number.isSafeInteger(this.ownLockIt32724PickerRoundStart),'AG integrity: own32724 free original round absent');
   assert(event==='FREE_GAME','AG integrity: own32724 actual selected free request');assert.deepStrictEqual(parameters,OwnLockIt32724Data.betFields(this.ownLockIt32724State),'AG integrity: own32724 free current selected DATA');
   this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);try{
    const p=this.decode(step,event),c=ownLockIt32724Profile(this.game),win=gdmInteger(p.TW,'own32724 actual free TW'),end=gdmInteger(p.AB,'own32724 actual free AB');
    if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: own32724 actual free account differs');
    const selected=OwnLockIt32724Data.applySelectedFree(this.ownLockIt32724State,p,this.ownLockIt32724FreeMode);
    const terminal=Boolean(selected.ownLifecycleEnd),mode=this.ownLockIt32724FreeMode;
    if(terminal){
     assert(((c.ownLockIt32724WholeLILCapture==='own32724-real-LIL-selected-end-whole-round-v1'&&mode==='lil')||(c.ownLockIt32724WholeFGCapture==='own32724-real-FG-selected-end-whole-round-v1'&&mode==='fg')),'AG integrity: own32724 selected lifecycle remains diagnostic before whole-money/replay/Mongo admission');
     assert(!this.ownLockIt32724State.H$&&!this.ownLockIt32724State.rJ,'AG integrity: own32724 actual LIL accounting pending selector');
     assert(end===this.ownLockIt32724PickerRoundStart-c.betRaw+win,'AG integrity: own32724 original selected feature whole cash conservation');
     // Only adapter continuation flags end here. Native retained model fields
     // are left exactly as the successful response and local SDK close left them.
     this.ownLockIt32724FreeMode='';this.ownLockIt32724PendingFirstLIL=false;this.ownLockIt32724PendingFirstStart=false;this.ownLockIt32724PickerPhase='';
    }
    this.balance=end;const start=this.ownLockIt32724PickerRoundStart;
    return{NextActionInfo:{nextAction:terminal?'SPIN':'FREE_SPIN'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:c.betRaw/100,resultAmount:win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
     startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:1,msgIds:[event],steps:[{...step,responseBalance:end}],SGWireResponse:p,SGDecodedResponseXML:step.responseXml,
     SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownSelectedFreeNext:selected,actualSelectedTerminal:terminal,wholeLILMoneyValidated:terminal,noSyntheticTerminal:true,wholeFeatureCoverageClaimed:false},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:win}};
   }catch(error){this.close();throw error;}
  }
  if(pickerDiagnostic&&this.ownLockIt32724PickerPhase&&event!=='BET'){
   assert(!this.closed&&this.ownLockIt32724InitBound&&Number.isSafeInteger(this.ownLockIt32724PickerRoundStart),'AG integrity: own32724 picker original round not bound');
   const exact=this.getExactFollowUpRequest('FREE_SPIN');assert(event===exact.event,'AG integrity: own32724 actual picker order');assert.deepStrictEqual(parameters,exact.parameters,'AG integrity: own32724 actual picker DATA');
   this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);try{
    const p=this.decode(step,event),c=ownLockIt32724Profile(this.game);
    const win=gdmInteger(p.TW,'own32724 actual feature TW'),end=gdmInteger(p.AB,'own32724 actual feature AB');
    if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: own32724 actual feature account differs');
    OwnLockIt32724Data.applyPickerResponse(this.ownLockIt32724State,p,event);
    if(event==='FEATURE_END'){if(!freeDiagnostic)throw new Error('AG integrity: own32724 successful FEATURE_END next Bonus/free/LIL unmapped; diagnostic stopped');this.ownLockIt32724FreeMode=OwnLockIt32724Data.selectFreeAfterEND(this.ownLockIt32724State);this.ownLockIt32724PickerPhase='';}
    if(event!=='FEATURE_END')this.ownLockIt32724PickerPhase=event==='FEATURE_START'?'pick':'end';this.balance=end;
    const start=this.ownLockIt32724PickerRoundStart;
    return{NextActionInfo:{nextAction:'FREE_SPIN'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:c.betRaw/100,resultAmount:win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
     startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:1,msgIds:[event],steps:[{...step,responseBalance:end}],SGWireResponse:p,SGDecodedResponseXML:step.responseXml,
     SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownActualPickerNext:this.getExactFollowUpRequest('FREE_SPIN'),noSyntheticTerminal:true,unmappedActualNextStops:true,wholeFeatureCoverageClaimed:false},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:win}};
   }catch(error){this.close();throw error;}
  }
  if(pickerDiagnostic&&event==='BET'&&!this.ownLockIt32724PickerPhase)this.ownLockIt32724PickerRoundStart=this.balance;

  if(ownLockIt32724Profile(this.game)?.ownLockIt32724FirstLILDiagnostic&&event==='FREE_GAME'){
   assert(!this.closed&&this.ownLockIt32724InitBound&&this.ownLockIt32724PendingFirstLIL,'AG integrity: own32724 first LIL not selected');
   assert.deepStrictEqual(parameters,OwnLockIt32724Data.betFields(this.ownLockIt32724State),'AG integrity: own32724 actual first LIL current fields');
   this.lastRequest={event,parameters:{...parameters}};
   const step=await this.exchange(event,parameters);try{
    this.decode(step,event);
    throw new Error('AG integrity: own32724 successful first LIL FREE_GAME response next unmapped; diagnostic stopped');
   }catch(error){this.close();throw error;}
  }
  if(diagnostic&&event==='FEATURE_START'){
   assert(!this.closed&&this.ownLockIt32724InitBound&&this.ownLockIt32724PendingFirstStart,'AG integrity: own32724 first START not selected');
   assert.deepStrictEqual(parameters,{CFG:'0'},'AG integrity: own32724 actual first START fields');
   this.lastRequest={event,parameters:{...parameters}};
   const step=await this.exchange(event,parameters);try{
    this.decode(step,event); // Preserve real successful envelope and journal before stopping.
    throw new Error('AG integrity: own32724 successful FEATURE_START response next unmapped; diagnostic stopped');
   }catch(error){this.close();throw error;}
  }
  assert(!diagnostic||!this.ownLockIt32724PendingFirstStart&&!this.ownLockIt32724PendingFirstLIL,'AG integrity: own32724 pending first continuation cannot accept another paid request');
  assert(!this.closed&&this.ownLockIt32724InitBound&&event==='BET'&&parameters,'AG integrity: own32724 actual initialized ordinary request required');
  assert.deepStrictEqual(parameters,this.getSpinParams(),'AG integrity: own32724 current selected request');
  const start=this.balance,c=ownLockIt32724Profile(this.game);assert(Number.isSafeInteger(start));this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event),endProof=pickerDiagnostic?OwnLockIt32724Data.applyPickerBET(this.ownLockIt32724State,p,c.ownLockIt32724CurrentPaidPickerDATA==='own32724-current-paid-explicit-FS0-request-projection-v1',c.ownLockIt32724LILCurrentSelectorDATA==='own32724-current-rJ-pending-NFG-LIL-selector-v1'):c.ownLockIt32724FirstLILDiagnostic?OwnLockIt32724Data.applyFirstLILOrPrior(this.ownLockIt32724State,p):diagnostic?OwnLockIt32724Data.applyFirstStartOrOrdinary(this.ownLockIt32724State,p):OwnLockIt32724Data.applyOrdinaryAndRequireActualEnd(this.ownLockIt32724State,p);
   const win=gdmInteger(p.TW,'own32724 actual TW'),end=gdmInteger(p.AB,'own32724 actual AB');
   if(!endProof.firstStartPending&&!endProof.firstLILPending)assert(end===start-c.betRaw+win,'AG integrity: own32724 original whole cash conservation');
   this.ownLockIt32724PendingFirstStart=endProof.firstStartPending===true;this.ownLockIt32724PendingFirstLIL=endProof.firstLILPending===true;if(pickerDiagnostic&&endProof.firstStartPending)this.ownLockIt32724PickerPhase='start';if(freeDiagnostic&&endProof.firstLILPending)this.ownLockIt32724FreeMode='lil';
   if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: own32724 captured actual account differs');this.balance=end;
   return{NextActionInfo:{nextAction:this.ownLockIt32724PendingFirstStart||this.ownLockIt32724PendingFirstLIL?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:c.betRaw/100,resultAmount:win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
    startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:1,msgIds:['BET'],steps:[{...step,responseBalance:end}],SGWireResponse:p,SGDecodedResponseXML:step.responseXml,
    SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32724OrdinaryLifecycleEnd:endProof,noSyntheticTerminal:true,unmappedActualNextStops:true,wholeFeatureCoverageClaimed:false},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:win}};
  }catch(error){this.close();throw error;}
 }

 private async ownSquid32735Connect(){
  if(!this.transport)assert(process.env.SG_AG_ALLOW_SOURCE==='1','AG integrity: GDM live source not enabled');
  try{
   const root=this.decode(await this.exchange('INIT',{GN:this.game.sg.runtimeSlug}),'INIT');
   const scalar=own32735Protocol.own32735Optional;
   assert(gdmInteger(root.B,'own32735 initial B')===gdmInteger(root.AB,'own32735 initial AB'),'AG integrity: own32735 fresh initial account');
   assert(scalar(root,'R',own32735Protocol.own32735Boolean,false)===false&&scalar(root,'NFG',own32735Protocol.own32735Integer,0)===0&&root.REC===undefined&&!(scalar(root,'CFG',own32735Protocol.own32735Integer)===2),'AG integrity: own32735 fresh INIT pending/recovery unmapped');
   assert(!(scalar(root,'IFR',own32735Protocol.own32735Boolean,false)||scalar(root,'FRR',own32735Protocol.own32735Integer,0)>0),'AG integrity: own32735 platform FreeRounds request unmapped');
   this.ownSquid32735Stake=own32735Protocol.own32735InitMenu(root);
   own32735Protocol.own32735SelectAvailableTotal(this.ownSquid32735Stake,Number(this.game.sg.requestParams.BPR));
   this.balance=gdmInteger(root.B,'own32735 initial B');
   this.decode(await this.exchange('REELSTRIP',{GN:this.game.sg.runtimeSlug}),'REELSTRIP');
  }catch(error){this.close();throw error;}
 }
 private async ownSquid32735Call(event:string,parameters:Record<string,any>|null){
  const profile=ownSquid32735Profile(this.game),c=gdmBinding(this.game),s=this.ownSquid32735State;
  assert(profile&&!this.closed&&parameters&&this.ownSquid32735Stake,'AG integrity: own32735 closed or actual INIT context absent');
  if(event==='BET'){
   assert(!this.ownSquid32735Request(),'AG integrity: own32735 previous actual round pending');
   assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: own32735 own BET fields');
   own32735Protocol.own32735SelectAvailableTotal(this.ownSquid32735Stake,Number(parameters.BPR));
   this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];
  }else{
   const next=this.ownSquid32735Request();assert(next&&next.event===event,'AG integrity: own32735 actual next request order');
   assert.deepStrictEqual(parameters,next.parameters,'AG integrity: own32735 actual next request fields');
   if(event==='FREE_GAME')own32735Protocol.ownFreeInputFields(s.model,this.ownSquid32735Stake);
   else own32735Protocol.ownFeatureWireInput(s.model,event,event==='FEATURE_PICK'?own32735Protocol.legalUIChoice(s.model):undefined);
  }
  assert(this.rootFlowSteps.length<10000,'AG integrity: own32735 finite round step bound');
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const root=this.decode(step,event),end=gdmInteger(root.B,'own32735 actual B'),available=gdmInteger(root.AB,'own32735 actual AB'),total=gdmInteger(root.TW,'own32735 actual TW');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own32735 captured account balance differs');
   assert(!(own32735Protocol.own32735Optional(root,'IFR',own32735Protocol.own32735Boolean,false)||own32735Protocol.own32735Optional(root,'FRR',own32735Protocol.own32735Integer,0)>0),'AG integrity: own32735 platform FreeRounds request unmapped');
   assert(typeof root.GSD==='string','AG integrity: own32735 actual GSD absent');
   const reported=own32735Protocol.own32735Optional(root,'BPR',own32735Protocol.own32735Integer);
   this.ownSquid32735Stake.Cd=null;own32735Protocol.ownReportedStakeSelection(this.ownSquid32735Stake,reported);
   own32735Protocol.applySuccessfulControl(s,event,own32735Protocol.decodeOwn32735RawControl(root,ownGDMFields(root.GSD,'#','~')));
   this.totalWin=total;const next=this.ownSquid32735Request();
   if(!next)assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   this.balance=end;this.rootFlowSteps.push({...step,responseBalance:end});const steps=next?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return{NextActionInfo:{nextAction:next?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:root,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32735ActualNextOnly:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }

 private ownTrinity32681Request(){
  const p=ownTrinity32681Profile(this.game);assert(p,'AG integrity: own32681 request scope');
  assert(!p.callerRequestUnresolved,'AG integrity: own32681 common connection binding unresolved');
  const next=own32681ControlNext(this.ownTrinity32681State,false);
  if(next.event===null)return undefined;
  if(next.event==='FREE_GAME')return{event:'FREE_GAME',parameters:{GN:this.game.sg.runtimeSlug,BPR:String(this.ownTrinity32681SelectedTotal),RB:'5'}};
  const r=own32681FeatureFieldsAndConsume(structuredClone(this.ownTrinity32681State),next.event);
  return{event:r.event,parameters:{GN:this.game.sg.runtimeSlug,...r.fields}};
 }
 private async ownTrinity32681Call(event:string,parameters:Record<string,any>|null){
  const p=ownTrinity32681Profile(this.game),c=gdmBinding(this.game),s=this.ownTrinity32681State;
  assert(p&&!p.callerRequestUnresolved&&!this.closed&&parameters,'AG integrity: own32681 closed or unresolved caller');
  if(event==='BET'){
   assert(!this.ownTrinity32681Request(),'AG integrity: own32681 prior actual round pending');
   assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: own32681 own BET fields');
   this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];this.ownTrinity32681SelectedTotal=Number(parameters.BPR);
  }else{
   const next=this.ownTrinity32681Request();assert(next&&next.event===event,'AG integrity: own32681 actual next request order');assert.deepStrictEqual(parameters,next.parameters,'AG integrity: own32681 actual next fields');
   if(event!=='FREE_GAME')own32681FeatureFieldsAndConsume(s,event as Own32681FeatureEvent);
  }
  assert(this.rootFlowSteps.length<10000,'AG integrity: own32681 finite round step bound');
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const w=this.decode(step,event),end=gdmInteger(w.B,'own32681 actual B'),available=gdmInteger(w.AB,'own32681 actual AB'),total=gdmInteger(w.TW,'own32681 actual TW');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own32681 captured account balance differs');
   const promotional=(w.FRR!==undefined&&own32681Integer(w.FRR,'actual platform FRR')>0)||(w.IFR!==undefined&&own32681Boolean(w.IFR));
   assert(!promotional,'AG integrity: own32681 platform FreeRounds request unmapped');
   assert(typeof w.GSD==='string','AG integrity: own32681 actual GSD absent');
   // Actual returned selected-total state may update the next FREE wager.
   // No response counter, displayed CW or unrelated cumulative equation is used.
   if(w.BPR!==undefined){const selected=gdmInteger(w.BPR,'own32681 actual selected total');assert(selected>0,'AG integrity: own32681 actual selected total absent');this.ownTrinity32681SelectedTotal=selected;}
   applyOwn32681SuccessfulDecoded(s,event as Own32681Event,own32681DecodeControl(w,ownGDMFields(w.GSD,'#','~')));
   this.totalWin=total;const next=this.ownTrinity32681Request();
   if(!next)assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   this.balance=end;this.rootFlowSteps.push({...step,responseBalance:end});const steps=next?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return{NextActionInfo:{nextAction:next?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:w,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32681ActualNextOnly:true,fixtureACKNotProviderACK:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }

 private async ownChain32476Call(event:string,parameters:Record<string,any>|null){
  const c=gdmBinding(this.game),first=event==='BET',state=this.ownChain32476State;
  assert(ownChain32476Profile(this.game)&&!this.closed&&parameters,'AG integrity: own32476 ACK closed scope');
  if(first){assert(!state.pending,'AG integrity: own32476 prior actual round pending');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: own32476 BET fields');this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];}
  else{assert(state.pending?.event===event,'AG integrity: own32476 actual next request order');assert.deepStrictEqual(parameters,state.pending.parameters,'AG integrity: own32476 actual next fields');}
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const wire=this.decode(step,event),end=gdmInteger(wire.B,'own32476 actual B');
   if(event==='BET'||event==='FREE_GAME')assert(wire.AB!==undefined,'AG integrity: own32476 actual spin AB absent');
   if(wire.AB!==undefined){const available=gdmInteger(wire.AB,'own32476 actual AB');if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own32476 captured account balance differs');}
   else if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: own32476 captured actual B differs');
   if(wire.GA!==undefined)assert(!ownChainBoolean(wire.GA),'AG integrity: own32476 actual gamble request unmapped');
   if(wire.FRR!==undefined)assert(ownChainInteger(wire.FRR,'actual platform FRR')<=0,'AG integrity: own32476 actual platform FreeRounds request unmapped');
   const gsd=wire.GSD===undefined?{}:ownGDMFields(wire.GSD,'#','~');
   if(event==='BET'||event==='FREE_GAME'){
    assert(wire.GSD!==undefined,'AG integrity: own32476 required own GSD absent');
    const actualSpinTW=gdmInteger(wire.TW,'own32476 actual spin TW');state.actualSpinTW=actualSpinTW;this.totalWin=actualSpinTW;
   }else{assert(event==='ACK'&&state.actualSpinTW!==undefined&&Number.isSafeInteger(state.actualSpinTW),'AG integrity: own32476 sparse ACK has no prior actual TW');this.totalWin=state.actualSpinTW;}
   updateOwnChain32476Next(state,event,wire,gsd);
   const pending=!!state.pending;
   if(!pending)assert(end===this.roundStart-c.betRaw+this.totalWin,'AG integrity: GDM original whole cash conservation');
   this.balance=end;this.rootFlowSteps.push({...step,responseBalance:end});const steps=pending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:pending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:this.totalWin/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:this.totalWin/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:wire,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,own32476ActualACKNext:true,ACKTWOnlyRetainedFromOwnPriorSuccessfulSpin:event==='ACK',noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:this.totalWin}};
  }catch(error){this.close();throw error;}
 }

 private async ownCoinComboCall(event:string,parameters:Record<string,any>|null){
  const profile=ownCoinComboProfile(this.game),c=gdmBinding(this.game),first=event==='BET';
  assert(profile&&!this.closed&&parameters,'AG integrity: Coin Combo own session closed');
  if(first){assert(!this.ownCoinState.next,'AG integrity: Coin Combo previous round pending');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: Coin Combo own BET fields');this.roundStart=this.balance;this.totalWin=0;this.rootFlowSteps=[];}
  else retainRequestedCoinAction(this.ownCoinState,{event,parameters:{...parameters}});
  this.lastRequest={event,parameters:{...parameters}};const step=await this.exchange(event,parameters);
  try{
   const wire=this.decode(step,event);const end=gdmInteger(wire.B,'Coin Combo actual B'),total=gdmInteger(wire.TW,'Coin Combo actual TW'),available=gdmInteger(wire.AB,'Coin Combo actual AB');
   assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM original whole cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: GDM source captured balance differs');
   for(const k of c.freeBudgetContract.promotionalKeysForbidden.filter((k:string)=>k!=='IFR'))assert(wire[k]===undefined,'AG integrity: Coin Combo promotional controller next unmapped');
   updateOwnCoinComboNext(profile,this.ownCoinState,event,wire,wire.GSD===undefined?{}:ownGDMFields(wire.GSD,'#','~'));
   this.balance=end;this.totalWin=total;this.rootFlowSteps.push({...step,responseBalance:end});
   const pending=!!this.ownCoinState.next,steps=pending?this.rootFlowSteps.slice(-1):this.rootFlowSteps;
   return {NextActionInfo:{nextAction:pending?'FREE_SPIN':'SPIN'},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:wire,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownCoinComboRequestNextEnd:true,noSyntheticTerminal:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(error){this.close();throw error;}
 }

 private async freeCall(event:string,parameters:Record<string,any>|null){
  const c=gdmBinding(this.game),rule=c.freeBudgetContract;assert(!this.closed&&parameters&&rule,'AG integrity: GDM free session closed');
  const first=event==='BET';assert(first?!this.freeState:this.ownPendingFree()&&event==='FREE_GAME','AG integrity: GDM own free action');
  assert.deepStrictEqual(parameters,first?this.game.sg.requestParams:rule.freeRequestParams,'AG integrity: GDM own free request parameters');
  const before=this.balance;assert(Number.isSafeInteger(before));if(first){this.roundStart=before;this.totalWin=0;this.freeSteps=[];}this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event);ownGDMFreeEnvelope(this.game,p,event);
   const total=gdmInteger(p.TW,'cumulative returned cash'),end=gdmInteger(p.B,'returned free balance'),available=gdmInteger(p.AB,'available source balance');
   const remaining=p.NFG===undefined&&first?0:gdmInteger(p.NFG,'actual remaining free budget');
   // Own SDK decodes B and AB separately. Real complete source chains keep
   // AB at the charged round balance or release it to B; no cash is defaulted.
   assert(available===end||((!first||remaining>0)&&available===this.roundStart-c.betRaw),'AG integrity: GDM own B/AB cumulative return split');
   if(first){assert(end===before-c.betRaw+total,'AG integrity: GDM paid intro cash');
    if(remaining>0){const all=gdmInteger(p.TFG,'initial free total'),played=gdmInteger(p.CFGG,'initial played'),rawFeatureCash=gdmInteger(p.FGTW,'initial feature cash');assert(played===0&&all===remaining&&rawFeatureCash<=total&&gdmInteger(p.CW,'paid intro current cash')===total,'AG integrity: GDM genuine free intro');const win=rule.ownSDKReturnedCashBinding?0:rawFeatureCash;this.freeState={total:all,played,remaining,win,offset:total-win,...(['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)?{stageFID:p.FID,...(['own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)&&p.FID==='0|1|'?this.ownExtraStageCounter(p,undefined):{})}: {})};}
   }else{const prior=this.freeState!;const all=gdmInteger(p.TFG,'returned free total'),played=gdmInteger(p.CFGG,'returned played'),rawFeatureCash=gdmInteger(p.FGTW,'returned auxiliary feature cash'),win=rule.ownSDKReturnedCashBinding?total-prior.offset:rawFeatureCash,current=gdmInteger(p.CW,'current free cash');
    const counters=['own-SDK-returned-cash-stage-trial-v6','own-SDK-returned-cash-stage-followup-trial-v7','own-SDK-returned-cash-stage-reentry-trial-v8'].includes(c.version)?this.ownExtraStageCounter(p,prior):undefined;
    if(!counters)assert(played===prior.played+1&&all>=prior.total&&played+remaining===all&&remaining===prior.remaining-1+all-prior.total,'AG integrity: GDM free counter transition');
    assert(win>=prior.win&&current===win-prior.win&&total===prior.offset+win&&total===this.totalWin+current&&end===before+current,'AG integrity: GDM free cash transition');this.freeState={total:all,played,remaining,win,offset:prior.offset,...counters};
   }
   assert(end===this.roundStart-c.betRaw+total,'AG integrity: GDM whole free cash');if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: GDM captured available balance mismatch');this.balance=end;this.totalWin=total;this.freeSteps.push({...step,responseBalance:end});
   const info=this.freeState?{freeSpinsTotal:this.freeState.total,freeSpinsPlayed:this.freeState.played,freeSpinsRemaining:this.freeState.remaining,accumulativeWin:this.freeState.win/100}:undefined;
   const next=this.ownPendingFree()?'FREE_SPIN':'SPIN',steps=next==='SPIN'?this.freeSteps:this.freeSteps.slice(-1);if(next==='SPIN')this.freeState=undefined;
   return{NextActionInfo:{nextAction:next},PlayerBalanceInfo:{preWagerBalance:this.roundStart/100,balance:end/100,wager:c.betRaw/100,resultAmount:total/100},...(info?{FreeSpinsInfo:info}:{}),capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:this.roundStart/100,endBalance:end/100,totalWin:total/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,ownNFGPredicateAndNoPromotionalFreeRounds:true,otherFeatureNotAdmitted:true},money:{startBalanceRaw:this.roundStart,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:total}};
  }catch(e){this.close();throw e;}
 }

 private async ownClassicNativeGameplayCall(event:string,parameters:Record<string,any>|null){
  assert(!this.closed&&parameters,'AG integrity: own native closed/missing request');const driver=ownClassicGameplayDrivers.get(this);assert(driver,'AG integrity: own native driver absent');
  try{
   const preparation=driver.beforeSend(event,parameters);assert(preparation?.roundScope&&['BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(event),'AG integrity: private native request scope');
   if(event==='BET'){this.roundStart=this.balance;this.freeSteps=[];}
   this.lastRequest={event,parameters:{...parameters}};
   const step=await this.exchange(event,parameters),p=this.decode(step,event),raw=ownClassicGameplayRaw.get(step);
   assert(raw&&raw.sessionScope===this&&!this.closed,'AG integrity: own native original gameplay response association');
   const frame=Object.freeze({...raw,roundScope:preparation.roundScope,decoded:Object.freeze({...p})});ownClassicGameplayPending.set(this,frame);
   const source=Object.freeze({read:(session:object,roundScope:object)=>{assert(!this.closed&&session===this&&roundScope===frame.roundScope&&ownClassicGameplayPending.get(this)===frame,'AG integrity: own native gameplay frame revoked');return frame;},has:(value:unknown)=>!this.closed&&value===frame&&ownClassicGameplayPending.get(this)===frame});
   const result=await driver.consume(source);
   assert(!this.closed&&ownClassicGameplayDrivers.get(this)===driver&&source.has(frame)&&result?.originalResponseFrame===frame,'AG integrity: own native gameplay response/driver revoked');
   const pending=result.pendingNativeRequest,terminal=!pending;
   if(terminal)assert(result.nativeRoundCloseObserved===true&&result.nativeResultShownObserved===true&&result.nativeRoundActiveAfter===false,'AG integrity: own native true round close not mapped');
   else assert(['FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(pending.event)&&!result.nativeRoundCloseObserved&&result.nativeRoundActiveAfter,'AG integrity: own native continuation not mapped');
   const start=this.roundStart,end=gdmInteger(p.B,'own native returned balance'),win=gdmInteger(p.TW,'own native actual returned win'),bet=this.game.sg.betRaw;
   const available=gdmInteger(p.AB,'own native actual available balance');
   if(terminal)assert(end===start-bet+win,'AG integrity: own native original final cash conservation');
   assert(result.nativeAccountBalance===available,'AG integrity: own native account/available balance differs');
   if(step.responseBalance!==undefined)assert(step.responseBalance===available,'AG integrity: own native captured available balance differs');
   this.balance=end;this.freeSteps.push({...step,responseBalance:end});
   const steps=terminal?this.freeSteps:this.freeSteps.slice(-1),r=result.decodedNativeResponse;
   const info=pending?.event==='FREE_GAME'||event==='FREE_GAME'?{freeSpinsTotal:r.totalFreeGames,freeSpinsPlayed:r.currentFreeGame,freeSpinsRemaining:r.numberFreeGames,accumulativeWin:win/100}:undefined;
   if(terminal){driver.acceptClosedRound();ownClassicGameplayPending.delete(this);}
   return{NextActionInfo:{nextAction:terminal?'SPIN':pending.event==='FREE_GAME'?'FREE_SPIN':'FEATURE'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:bet/100,resultAmount:win/100},...(info?{FreeSpinsInfo:info}:{}),capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:steps.length,msgIds:steps.map(x=>x.msgId),steps:structuredClone(steps),SGWireResponse:p,SGDecodedResponseXML:step.responseXml,SGOwnSDKDecision:{ownSDKFileSHA256:this.game.sg.ownGDMContract.ownSDKFileSHA256,actualNativeRoundClose:terminal,privateNativeFreeFlow:true,unmappedNextStops:true},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:bet,totalWinRaw:win}};
  }catch(error){this.close();throw error;}
 }

 async callGameData(event:string,parameters:Record<string,any>|null){
  if(OwnNOVABrowserConnection.profile(this.game)){const native=ownNOVABrowserSessions.get(this);assert(native&&!this.closed,'Own NOVA full original connection required');try{return await native.call(event,parameters);}catch(error){this.close();throw error;}}
  assert(!ownNOVANativeInitProfile(this.game),'Own NOVA initialization-only connection cannot send gameplay');
  if(ownClassicGameplayDrivers.has(this))return this.ownClassicNativeGameplayCall(event,parameters);
  assert(!ownClassicInitProfile(this.game),'AG integrity: own classic next/end graph not yet admitted');
  if(ownLockIt32724Profile(this.game))return this.ownLockIt32724Call(event,parameters);
  if(ownSquid32735Profile(this.game))return this.ownSquid32735Call(event,parameters);
  if(ownGreenMachine32839Profile(this.game))return this.ownGreenMachine32839Call(event,parameters);
  if(ownDFDC32709Profile(this.game))return this.ownDFDC32709Call(event,parameters);
  if(ownTrinity32681Profile(this.game))return this.ownTrinity32681Call(event,parameters);
  if(ownChain32476Profile(this.game))return this.ownChain32476Call(event,parameters);
  if(ownCoinComboProfile(this.game))return this.ownCoinComboCall(event,parameters);
  if(this.game.sg.ownGDMContract.ownRootNFGFlowOnlyCapture)return this.rootFlowCall(event,parameters);
  if(this.game.sg.ownGDMContract.freeBudgetContract)return this.freeCall(event,parameters);
  assert(!this.closed&&event==='BET'&&parameters,'AG integrity: GDM own ordinary request');assert.deepStrictEqual(parameters,this.game.sg.requestParams,'AG integrity: GDM own request parameters changed');
  const start=this.balance;assert(Number.isSafeInteger(start));this.lastRequest={event,parameters:{...parameters}};
  const step=await this.exchange(event,parameters);try{
   const p=this.decode(step,event),c=gdmBinding(this.game);
   assert(ownGDMOrdinaryFinal(this.game,p),'AG integrity: GDM own SDK requires genuine continuation');
   const win=gdmInteger(p.TW,'own returned win'),end=gdmInteger(p.B,'own returned balance');assert(p.AB===p.B&&end===start-c.betRaw+win,'AG integrity: GDM own final cash conservation');
   if(step.responseBalance!==undefined)assert(step.responseBalance===end,'AG integrity: GDM captured cash differs');this.balance=end;
   return{NextActionInfo:{nextAction:'SPIN'},PlayerBalanceInfo:{preWagerBalance:start/100,balance:end/100,wager:c.betRaw/100,resultAmount:win/100},capturePlatform:'sg',gameId:this.game.sg.runtimeGameId,runtimeSlug:this.game.sg.runtimeSlug,
    startBalance:start/100,endBalance:end/100,totalWin:win/100,stepCount:1,msgIds:['BET'],steps:[{...step,responseBalance:end}],SGWireResponse:p,SGDecodedResponseXML:step.responseXml,
    SGOwnSDKDecision:{ownSDKFileSHA256:c.ownSDKFileSHA256,verifiedOwnOrdinaryFinal:true,unseenFeatureNotAdmitted:true},money:{startBalanceRaw:start,endBalanceRaw:end,betRaw:c.betRaw,totalWinRaw:win}};
  }catch(e){this.close();throw e;}
 }
 close(){
  const nativeFull=ownNOVABrowserSessions.get(this);ownNOVABrowserSessions.delete(this);ownNOVABrowserPending.delete(this);nativeFull?.close();
  const nativeInitOnly=ownNOVAInitOnlySessions.get(this);ownNOVAInitOnlySessions.delete(this);nativeInitOnly?.close();
  if(ownClassicInitProfile(this.game)){
   const driver=ownClassicGameplayDrivers.get(this);this.closed=true;
   ownClassicGameplayDrivers.delete(this);ownClassicGameplayPending.delete(this);
   try{driver?.close();}
   catch(error){try{this.evidence({phase:'native-cleanup-fault',cleanupErrorName:error instanceof Error?error.name:'unknown'});}catch{}}
   finally{
    ownClassicReelstripFrames.delete(this);ownClassicInitPending.delete(this);ownClassicInitValidated.delete(this);ownClassicInitData.delete(this);this.cookies.clear();
    const journal=this.journal;this.journal=null;if(journal!==null){try{fs.closeSync(journal);}catch{}}
   }
   return;
  }
  ownClassicReelstripFrames.delete(this);ownClassicGameplayDrivers.get(this)?.close();ownClassicGameplayDrivers.delete(this);ownClassicGameplayPending.delete(this);ownClassicInitPending.delete(this);ownClassicInitValidated.delete(this);ownClassicInitData.delete(this);this.closed=true;this.cookies.clear();if(this.journal!==null){fs.closeSync(this.journal);this.journal=null;}
 }
}


// Own32724 protocol DATA. Financial/replay/Mongo/finite-loop remain original AG.
export const ownLockIt32724Binding={"SDKFileSHA256":"78a68f7f5a40997b9eb01f2dd53056a97770c1153d7a63bf7d84b6c5b3f5ad3d","gameId":"32724","dbName":"sg_lockitlinkdiamonds96","runtimeGameId":33124,"runtimeSlug":"lockitlinkdiamonds96","sourceProfile":"ordinary-current-input-real-lifecycle-end-v1","selectedPerLine":5,"sourcePaylines":50,"betRaw":250,"unknownActualNextStops":true,"noSyntheticTerminal":true,"noMoneyOrBonusDefaults":true,"wholeFeatureCoverageClaimed":false};
const OwnLockIt32724Data=(()=>{
 const core:any={qo:{},LF:{},Dea:{},Error:{},pa:{},Xb:{}},dollar:any={Kb:{},LF:{},LK:{},qfa:{},Xb:{}};
 const ownNS:any={un:{GB:{eG:0}},hga:{},d0:{},e1:{},C0:{},v0:{}};
 const D:any={Da:core,$:{Da:dollar}};
 core.qo.clear=function(a){a.bf=0;a.Ei={}};
 core.LF.clear=function(a){a.Uj=null;a.C9=!1;a.kj=!1};
 core.Dea.clear=((a:any)=>(function(k){k.eh=k.eh||{};a.qo.clear(k.eh);k.Ix="GBP";k.gg=1;k.UW=null;k.cK=null}))(core);
 core.Error.clear=((k:any)=>(function(a){a.type=k.xc;a.fatal=null;a.title=null;a.message=null;a.options=null}))({xc:0});
 core.pa.clear=((k:any)=>(function(a){a.state=k.Gg;a.Ks=!1;a.$Ta=!1;a.Ik=!1}))({Gg:2});
 core.Xb.clear=function(a){a.Bc=[];a.Be=0;a.Mq=0};
 core.clear=((a:any)=>(function(e){e.error=e.error||{};a.Error.clear(e.error);e.Bf=e.Bf||{};a.Dea.clear(e.Bf);e.gc=e.gc||{};a.LF.clear(e.gc);e.state=e.state||{};a.pa.clear(e.state);e.Na=e.Na||{};a.Xb.clear(e.Na);e.seed=null}))(core);
 dollar.Kb.clear=function(a){a.Kq=0;a.ve=[];a.Zj=null};
 dollar.LF.clear=((a:any,e:any)=>(function(f){a.Da.LF.clear(f);f.hi=null;f.Aca=[];f.rF=null;f.Ji=null;f.MPa=null;f.CA={};e.Kb.clear(f.CA);f.pI=!0}))(D,dollar);
 dollar.LK.clear=function(a){a.ho=!1;a.pr=null;a.Fe=null;a.rr=null;a.Nx=null};
 dollar.qfa.clear=function(a){for(var c in a)delete a[c]};
 dollar.Xb.clear=((a:any)=>(function(b){b.Ss=[];b.ip=0;b.S7=0;b.us=null;a.Da.Xb.clear(b)}))(D);
 dollar.clear=((a:any,e:any)=>(function(k){a.Da.clear(k);k.gc=k.gc||{};e.LF.clear(k.gc);k.Na=k.Na||{};e.Xb.clear(k.Na);k.ec=k.ec||{};e.LK.clear(k.ec);k.pd=k.pd||[];k.pd.length=0;k.by=k.by||{};e.qfa.clear(k.by)}))(D,dollar);
 ownNS.un.clear=function(a){a.uP=null};
 ownNS.hga.clear=function(a){a.L9=!1;a.sY=!1;a.I9=!1;a.STa=!1};
 ownNS.d0.clear=function(a){a.tE=[];a.nY=[]};
 ownNS.C0.clear=function(a){a.NP=[];a.links=[];a.Yx=[]};
 ownNS.v0.clear=function(a){a.lJ=[];a.mJ=[]};
 ownNS.e1.clear=ownNS.d0.clear;
 ownNS.clear=((D:any,a:any)=>(function(e){D.$.Da.clear(e);e.lE=e.lE||{};a.un.clear(e.lE);e.wp=e.wp||{};a.hga.clear(e.wp);e.Zx=e.Zx||{};a.d0.clear(e.Zx);e.DQ=e.DQ||{};a.e1.clear(e.DQ);e.$u=[];e.uJ=[];e.Rj=e.Rj||{};a.C0.clear(e.Rj);e.Saa=e.Saa||{};a.C0.clear(e.Saa);e.Ls=e.Ls||{};a.v0.clear(e.Ls)}))(D,ownNS);
 const h:any={pi:0,zn:1,Gv:2};
 const total=((h:any)=>(function f(a,b){switch(b.type){case h.pi:return{type:h.pi,value:b.value};case h.zn:return{type:h.pi,value:b.value*(a.Ss[a.ip]+(a.S7||0))};case h.Gv:if(null==a.us)throw Error("Stake type was CreditMultiplier but no baseCreditValue is present");return{type:h.pi,value:b.value*a.us};default:throw Error("Unknown stake type '"+b.type+"'");}}))(h),perLine=((h:any)=>(function c(a,b){switch(b.type){case h.pi:return{type:h.zn,value:b.value/(a.Ss[a.ip]+(a.S7||0))};case h.zn:return{type:h.zn,
value:b.value};case h.Gv:if(null==a.us)throw Error("Stake type was CreditMultiplier but no baseCreditValue is present");return{type:h.zn,value:b.value*a.us/a.Ss[a.ip]};default:throw Error("Unknown stake type '"+b.type+"'");}}))(h),credit=((h:any)=>(function b(a,b){if(null==a.us)throw Error("Stake type was CreditMultiplier but no baseCreditValue is present");switch(b.type){case h.pi:return{type:h.Gv,value:b.value/a.us};case h.zn:return{type:h.Gv,value:b.value*(a.Ss[a.ip]+(a.S7||0))/a.us};case h.Gv:return{type:h.Gv,value:b.value};
default:throw Error("Unknown stake type '"+b.type+"'");}}))(h);
 const selected=((h:any)=>(function d(a){return a.nd?a.nd.Ec?{type:h.pi,value:a.nd.Ec}:{type:h.zn,value:a.nd.Ij}:a.Bc[a.Be]}))(h);
 const setStake=((h:any,f:any,c:any,b:any)=>(function(a,d,k){for(var n=0;n<a.Bc.length;n++){var e=a.Bc[n];switch(d){case h.pi:if(f(a,e).value===k){a.Be=n;return}break;case h.zn:if(c(a,
e).value===k){a.Be=n;return}break;case h.Gv:if(b(a,e).value===k){a.Be=n;return}break;default:throw Error("Unknown stake type '"+d+"'");}}a.nd={Ec:f(a,{type:d,value:k}).value,Ij:c(a,{type:d,value:k}).value}}))(h,total,perLine,credit);
 dollar.Xb.ca=h;dollar.Xb.Rg=total;dollar.Xb.fo=selected;dollar.Xb.Xwa=setStake;
 const f8=((e:any)=>(function(){var a=this._context.game.ba,b=a.Na.nd;return null!=b?{type:e.Da.Xb.ca.pi,
value:b.Ec}:e.Da.Xb.fo(a.Na)}))({Da:dollar});const m8=function(){var a=this._context.game.ba;return{Rm:this.f8(),lo:a.Na.Ss[a.Na.ip]}};
 const Req:any=((b:any,a:any)=>(function d(d,c){var f=b.call(this,d,c)||this;c.lo&&(f.LP=c.lo,f.Ij=c.Rm.type===a.$.Da.Xb.ca.zn?c.Rm.value:a.$.Da.Xb.Rg(d.Na,c.Rm).value/c.lo);return f}))(function(this:any){return this;},D);
 const updateStake=((a:any,l:any)=>(function(b){if(null!=this.LP){var d=b.Ss.indexOf(this.LP);-1===d?l.vc.warn("Could not find payline option '"+this.LP+"' in stake model"):b.ip=d}null!=this.Ij&&a.$.Da.Xb.Xwa(b,a.$.Da.Xb.ca.zn,this.Ij);null!=this.eO&&a.$.Da.Xb.Xwa(b,a.$.Da.Xb.ca.Gv,this.eO)}))(D,{vc:{warn:()=>{}}});
 const eYa=function(a){this.z_&&(a.pgb=parseInt(this.z_[0]),a.H$=parseInt(this.z_[1]),a.ogb=parseInt(this.z_[2]));0!=a.H$&&(this.jja=a.wp.L9=!0)},cYa=((a:any)=>(function(b){if(this.ml&&1<this.ml.split("#").length){if(-1<this.ml.indexOf("#Hearts~")){var d=this.ml.split("#Hearts~")[1];-1<d.indexOf("#")&&(d=this.ml.split("#Hearts~")[1].split("#")[0]);var c=JSON.parse(d);d=c.hVals;c=c.initialHeartPos;b.Zx={tE:d,nY:c}}-1<this.ml.indexOf("#RespinHearts~")&&(d=this.ml.split("#RespinHearts~")[1],-1<
d.indexOf("#")&&(d=this.ml.split("#RespinHearts~")[1].split("#")[0]),c=JSON.parse(d),d=c.hVals,c=c.initialHeartPos,b.DQ={tE:d,nY:c});if(-1<this.ml.indexOf("#LinkData~")){d=this.ml.split("#LinkData~")[1];-1<d.indexOf("#")&&(d=this.ml.split("#LinkData~")[1].split("#")[0]);d=JSON.parse(d);c=d.links;var f=d.lockedHearts,e=d.heartPosInLinks,h=d.heartMultipliers;b.Rj={NP:f,bY:e,Tva:d.previousMultipliersInLinks,links:c,Yx:h}}else b.Rj.links=[];-1<this.ml.indexOf("#LILRecoveryInfo~")&&(d=this.ml.split("#LILRecoveryInfo~")[1],
-1<d.indexOf("#")&&(d=this.ml.split("#LILRecoveryInfo~")[1].split("#")[0]),d=JSON.parse(d),c=d.links,f=d.lockedHearts,e=d.heartPosInLinks,h=d.heartMultipliers,b.Saa={bY:e,NP:f,links:c,Tva:d,Yx:h});-1<this.ml.indexOf("#InitialLink~")?(b.Ls.lJ=this.bn.lJ,b.Ls.mJ=this.bn.mJ):a.Da.v0.clear(b.Ls);-1<this.ml.indexOf("#JPPosInLink~")?(d=this.ml.split("#JPPosInLink~")[1],b.uJ=d.substring(0,d.length).split(",")):b.uJ=[]}}))({Da:ownNS});
 const Fi=((a:any,c:any)=>(function(b){this.bn&&(b.qY=0==this.bn.qY?!1:!0,b.Pca=this.bn.TLa,b.GE=this.bn.GE?0==this.bn.GE?!1:!0:!1,b.rJ=this.bn.rJ?this.O3=0==this.bn.rJ?!1:!0:this.O3=!1,b.pp=this.bn.pp?0==this.bn.pp?!1:!0:!1,this.bn.rpa&&(b.upa=this.bn.rpa));b.xh=this.xh;b.rma={$N:this.$N,u6:this.u6,t6:this.t6};this.$u&&(b.$u=this.$u,this.Woa[a.Da.un.GB.eG]&&(b.wp.sY=this.Woa[a.Da.un.GB.eG]));this.Sna&&0==this.Sna&&(b.wp.STa=!0);this.eYa(b);this.cYa(b);c.prototype.Fi.call(this,b)}))({Da:ownNS},{prototype:{Fi:function(this:any,m:any){
  m.state.Ik=this.Ik||this.bn?.Ik;m.ec.ho=this.TTa;m.ec.Fe=this.X7;m.ec.pr=this.qQa;m.ec.Nx=this.qpa;
  updateStake.call(this,m.Na);
 }}});
 const integer=(v:any,label:string)=>{assert(typeof v==='string'&&/^-?\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'AG integrity: own32724 '+label);return Number(v);};
 const bool=(v:any,label:string)=>{assert(typeof v==='string'&&['0','1','true','false','yes','no','y','n'].includes(v.toLowerCase()),'AG integrity: own32724 '+label);return ['1','true','yes','y'].includes(v.toLowerCase());};
 const opt=(o:any,k:string,decode:any,missing:any=null)=>o[k]===undefined?missing:decode(o[k],k);
 const list=(s:string,sep:string)=>{const a=s.split(sep);a.pop();return a;};
 function createModel(){const model:any={};ownNS.clear(model);return model;}
 function initialize(m:any,p:any){
  assert(!opt(p,'R',bool,false)&&p.REC===undefined&&p.FID===undefined&&!opt(p,'IFG',bool,false)&&opt(p,'NFG',integer,0)===0,'AG integrity: own32724 fresh Init recovery unmapped');
  assert(!opt(p,'IFR',bool,false)&&!(opt(p,'FRR',integer,0)>0)&&p.FRT===undefined,'AG integrity: own32724 promotional Init unmapped');
  assert(typeof p.CUR==='string'&&/(?:ISO:)([A-Z]{3})/.test(p.CUR.split('|')[0]),'AG integrity: own32724 actual Init CUR required');
  assert(typeof p.BD==='string'&&typeof p.BDD==='string','AG integrity: own32724 actual Init menu required');
  const values=list(p.BD,'|').map((s:string)=>integer(s,'BD')),defaultValue=integer(p.BDD,'BDD');
  m.Na.Bc=values.map((value:number)=>({type:1,value}));const defaultIndex=values.lastIndexOf(defaultValue);
  m.Na.Mq=m.Na.Be=defaultIndex<0?0:defaultIndex;m.Na.ioa=0;m.Na.Ss=[50];m.Na.ip=0;
  const actualChoice=values.indexOf(5);assert(actualChoice>=0,'AG integrity: own32724 actual Init selected BPL5 unavailable');
  m.Na.Be=actualChoice;m.Na.nd=null;
 }
 function betFields(m:any){const ctx:any={_context:{game:{ba:m}},f8};const input=m8.call(ctx),request=new Req(m,input);
  assert(Number.isSafeInteger(request.LP)&&Number.isSafeInteger(request.Ij)&&request.LP>0&&request.Ij>0,'AG integrity: own32724 actual selected input required');
  assert(request.LP*request.Ij===250,'AG integrity: own32724 fixed capture wager changed');return {LB:String(request.LP),BPL:String(request.Ij)};
 }
 function applyOrdinaryAndRequireActualEnd(m:any,p:any){
  const gs=p.GSD===undefined?undefined:ownGDMFields(p.GSD,'#','~');
  const bn=gs===undefined?null:{qY:opt(gs,'EG',integer),TLa:opt(gs,'Bonus',integer),GE:opt(gs,'InRespin',integer),rJ:opt(gs,'LILTriggered',integer),pp:opt(gs,'InLIL',integer),Ik:opt(gs,'GCT',bool,false)};
  const response:any={jja:false,O3:false,eYa,cYa,bn,ml:p.GSD,z_:p.WC===undefined?null:list(p.WC,'|'),
   Ik:opt(p,'GCT',bool,false),X7:opt(p,'NFG',integer,0),TTa:opt(p,'IFG',bool,false),qQa:opt(p,'CFGG',integer,0),qpa:opt(p,'FGT',integer,0),
   LP:opt(p,'LB',integer),Ij:opt(p,'BPL',integer),eO:opt(p,'BPR',integer),
   xh:p.FID===undefined?null:list(p.FID,'|').map((s:string)=>integer(s,'FID')),Sna:opt(p,'CFGG',integer)};
  // Picker data is a real future branch. Stop before applying incomplete SDK
  // picker state; no completed per-variant old sample is required for admission.
  assert(!Object.keys(p).some(k=>/^(?:FPM|FS|NFR|CFR|CFP)_/.test(k)),'AG integrity: own32724 actual picker next unmapped');
  Fi.call(response,m);
  // This is the actual ordinary EL->gva->own qa->playFinished->own fG
  // inherited local close->idle route. Idle or accounting isFinal alone is
  // insufficient: every real pending selector below must be inactive first.
  assert(!m.state.Ik&&!m.ec.ho&&m.ec.Fe===0&&!m.rJ&&!m.pp&&!m.GE&&!(m.Pca>0)&&!(m.xh?.length),'AG integrity: own32724 actual next or terminal unmapped');
  assert(Number.isFinite(m.H$)&&m.H$===0,'AG integrity: own32724 actual retained WC required');
  betFields(m); // A reported change of the fixed capture stake must stop here.
  return {ordinaryLifecycle:'EL/gva/qa/playFinished/fG/local-close/idle',requiresNoFurtherWireRequest:true};
 }
 const firstPickType=((D:any,a:any)=>(function(e){var k="";if(!0===e.wp.L9)return!1===e.wp.sY?k=D.GDM.Gb.ng.TF:0<e.$u.length?0===e.$u[a.un.GB.eG][0].length?k=D.GDM.Gb.ng.ot:0<e.$u[a.un.GB.eG][0][0]&&(k=D.GDM.Gb.ng.Uy):k=e.wp.I9?D.GDM.Gb.ng.Uy:
D.GDM.Gb.ng.ot,k}))({GDM:{Gb:{ng:{TF:'FEATURE_START',ot:'FEATURE_PICK',Uy:'FEATURE_END'}}}},{un:{GB:{eG:0}}});
 function applyFirstStartOrOrdinary(m:any,p:any):any{
  const actualWC=p.WC===undefined?null:list(p.WC,'|');
  if(!actualWC||parseInt(actualWC[1])===0)return applyOrdinaryAndRequireActualEnd(m,p);
  const gs=p.GSD===undefined?undefined:ownGDMFields(p.GSD,'#','~');
  const bn=gs===undefined?null:{qY:opt(gs,'EG',integer),TLa:opt(gs,'Bonus',integer),GE:opt(gs,'InRespin',integer),rJ:opt(gs,'LILTriggered',integer),pp:opt(gs,'InLIL',integer),Ik:opt(gs,'GCT',bool,false)};
  const response:any={jja:false,O3:false,eYa,cYa,bn,ml:p.GSD,z_:p.WC===undefined?null:list(p.WC,'|'),
   Ik:opt(p,'GCT',bool,false),X7:opt(p,'NFG',integer,0),TTa:opt(p,'IFG',bool,false),qQa:opt(p,'CFGG',integer,0),qpa:opt(p,'FGT',integer,0),
   LP:opt(p,'LB',integer),Ij:opt(p,'BPL',integer),eO:opt(p,'BPR',integer),
   xh:p.FID===undefined?null:list(p.FID,'|').map((s:string)=>integer(s,'FID')),Sna:opt(p,'CFGG',integer)};
  // This diagnostic binds only the true first START branch. FS_0 is the
  // actual started selector, not a display counter. Any started picker remains held.
  if(p.FS_0!==undefined)assert(bool(p.FS_0,'FS_0')===false,'AG integrity: own32724 started picker next unmapped');
  Fi.call(response,m);
  assert(m.H$&&m.ec.Nx===0&&m.wp.L9===true&&m.wp.sY===false,'AG integrity: own32724 first START selector not bound');
  assert(firstPickType(m)==='FEATURE_START','AG integrity: own32724 actual first START source selector');
  betFields(m);
  return {firstStartPending:true,actualOwnRequest:'FEATURE_START',requiresNoFurtherWireRequest:false,wholeFeatureCoverageClaimed:false};
 }
 function applyFirstLILOrPrior(m:any,p:any,currentLILSelector=false):any{
  if(!(opt(p,'NFG',integer,0)>0)||(!currentLILSelector&&opt(p,'FGT',integer,0)!==3))return applyFirstStartOrOrdinary(m,p);
  const gs=p.GSD===undefined?undefined:ownGDMFields(p.GSD,'#','~');
  const bn=gs===undefined?null:{qY:opt(gs,'EG',integer),TLa:opt(gs,'Bonus',integer),GE:opt(gs,'InRespin',integer),rJ:opt(gs,'LILTriggered',integer),pp:opt(gs,'InLIL',integer),Ik:opt(gs,'GCT',bool,false)};
  const response:any={jja:false,O3:false,eYa,cYa,bn,ml:p.GSD,z_:p.WC===undefined?null:list(p.WC,'|'),
   Ik:opt(p,'GCT',bool,false),X7:opt(p,'NFG',integer,0),TTa:opt(p,'IFG',bool,false),qQa:opt(p,'CFGG',integer,0),qpa:opt(p,'FGT',integer,0),
   LP:opt(p,'LB',integer),Ij:opt(p,'BPL',integer),eO:opt(p,'BPR',integer),
   xh:p.FID===undefined?null:list(p.FID,'|').map((s:string)=>integer(s,'FID')),Sna:opt(p,'CFGG',integer)};
  if(!(bn?.rJ))return applyFirstStartOrOrdinary(m,p);
  assert(!Object.keys(p).some(k=>/^(?:FPM|FS|NFR|CFR|CFP)_/.test(k)),'AG integrity: own32724 LIL concurrent picker next unmapped');
  Fi.call(response,m);
  assert(m.H$===0&&m.rJ===true&&(currentLILSelector?!m.GE&&!m.pp:m.ec.Nx===3)&&m.ec.Fe>0&&!m.state.Ik&&m.xh?.[0]===3,'AG integrity: own32724 actual first LilSpin/prePlay selector not bound');
  betFields(m);
  return {firstLILPending:true,actualOwnRequest:'FREE_GAME',requiresNoFurtherWireRequest:false,wholeFeatureCoverageClaimed:false};
 }
 const ownIndexedDecode=(()=>{
 const a:any={O:{ya:function(a){return null!=a&&!isNaN(a)&&("number"===typeof a||a instanceof Number)}},vm:{},Qd:{so:{Ig:0}},cz:class extends Error{constructor(message:any,cause?:any){super(message);}}};
 a.as=function(a,l,k=null){return l(a)?a:k};a.vm.ya=function(c,b){void 0===b&&(b=null);return""==c?b:a.as(Number(c),a.O.ya,b)};
 const e:any={vc:{error:()=>{throw new Error('AG integrity: own32724 malformed actual indexed picker DATA');},warn:()=>{}}},B:any={Th:{Pk:0,U0:1,mga:2},U:{Cf:'|',Lj:1,kJ:'>',wP:false}},y=(a:any,...rest:any[])=>Object.assign(a,...rest);
 function h(a:any,b:any){return Error('Failed to read '+a+' as '+b);}
 function d(a:any,b:any){return Error('Invalid '+b);}
 function n(b){b=b?y(y({},n.U),b):n.U;b.RN=b.RN.map(function(a){return a.toLowerCase()});b.W5=b.W5.map(function(a){return a.toLowerCase()});return{oo:function(a){if(!0===
a)return b.S_a;if(!1===a)return b.Q_a;throw d(a,"boolean");},co:function(d){var c=a.vm.ya(d,null);if(null!=c)return 0!==c;c=d.toLowerCase();if(-1!==b.W5.indexOf(c))return!0;if(-1!==b.RN.indexOf(c))return!1;throw h(d,"boolean");}}}
 n.U={S_a:'1',Q_a:'0',W5:['true','y','yes'],RN:['false','n','no']};
 function l(b,h){var c=h?y(y({},B.U),h):B.U;return{oo:function(h){if(!a.O.array(h))throw d(h,"boolean");h=h.map(function(a){return b.oo(a)});return u(h,c)},co:function(a){return w(a,c).map(function(a){return b.co(a)})}}}
 function u(a,b){return p(t(a,b),b)}function w(a,b){a:switch(a=
a.split(b.Cf),b.Lj){case B.Th.Pk:break a;case B.Th.mga:a.shift();break a;case B.Th.U0:a.pop();break a;default:throw Error("Invalid strategy "+b.Lj);}if(b.wP){for(var d=[],h=0;h<a.length;h++){var c=a[h],f=c.indexOf(b.kJ);-1===f?(f=a.indexOf(c),e.vc.warn("Index missing from supposedly indexed string "+c+"; using existing index "+f),d[f]=c):d[c.substr(0,f)]=c.substr(f+b.kJ.length)}b=d}else b=a;return b}function p(a,b){switch(b.Lj){case B.Th.Pk:return a.join(b.Cf);case B.Th.mga:return a.map(function(a){return""+
b.Cf+a}).join("");case B.Th.U0:return a.map(function(a){return""+a+b.Cf}).join("");default:throw Error("Invalid strategy "+b.Lj);}}function t(a,b){return b.wP?a.map(function(a,d){return""+d+b.kJ+a}):a}
 const numberType={co:function(b){if(""===b.trim())throw h(b,"number");var d=a.vm.ya(b,null);if(!a.O.ya(d))throw h(b,"number");return d}},boolType=(n as any)();
 const x:any={get:()=>({$u:{key:'FPM_{#}',Vu:true,type:l(l(numberType,{Cf:';'}),{Cf:'|'})},Woa:{key:'FS_{#}',Vu:true,type:boolType}})},b:any=()=> 'own32724 indexed property';
 function c(d,h){var c=x.get(d,a.Qd.so.Ig),f;for(f in c){var n=c[f];if(n)try{var k=n.key;if(n.Vu){var l=k.indexOf("{#}"),r=k.substr(0,l),u=k.substr(l+3),w=d[f]=[],t;for(t in h)if(t.substr(0,l)===r){var p=parseInt(t.substr(l));
if(a.O.ya(p)&&t.substr(l+(""+p).length)===u){var q=h[t];try{w[p]=n.type.co(q)}catch(Ga){throw new a.cz("Could not deserialise '"+q+"'",Ga);}}}if(n.required&&0===w.length)throw Error("Property not found in message");}else if(k in h){q=h[k];try{d[f]=n.type.co(q)}catch(Ga){throw new a.cz("Could not deserialise '"+q+"'",Ga);}}else if(null!=n.defaultValue)d[f]=n.defaultValue;else{if(n.required)throw Error("Property not found in message");d[f]=null}}catch(Ga){var v=b(f,n,!0);if(n.required)throw new a.cz(v,
Ga);n.silent||(e.vc.error(v,Ga),d[f]=null)}}}
 return function(p:any){const response:any={};c(response,p);return response;};
 })();
 function applyPickerFields(m:any,p:any){
  const gs=p.GSD===undefined?undefined:ownGDMFields(p.GSD,'#','~');
  const bn=gs===undefined?null:{qY:opt(gs,'EG',integer),TLa:opt(gs,'Bonus',integer),GE:opt(gs,'InRespin',integer),rJ:opt(gs,'LILTriggered',integer),pp:opt(gs,'InLIL',integer),Ik:opt(gs,'GCT',bool,false)};
  const response:any={jja:false,O3:false,eYa,cYa,bn,ml:p.GSD,z_:p.WC===undefined?null:list(p.WC,'|'),
   Ik:opt(p,'GCT',bool,false),X7:opt(p,'NFG',integer,0),TTa:opt(p,'IFG',bool,false),qQa:opt(p,'CFGG',integer,0),qpa:opt(p,'FGT',integer,0),
   LP:opt(p,'LB',integer),Ij:opt(p,'BPL',integer),eO:opt(p,'BPR',integer),
   xh:p.FID===undefined?null:list(p.FID,'|').map((s:string)=>integer(s,'FID')),Sna:opt(p,'CFGG',integer)};
  Object.assign(response,ownIndexedDecode(p));Fi.call(response,m);betFields(m);
 }
 function applyPickerBET(m:any,p:any,currentPaidDATA=false,currentLILSelector=false):any{
  const wc=p.WC===undefined?null:list(p.WC,'|');
  if(!wc||parseInt(wc[1])===0)return applyFirstLILOrPrior(m,p,currentLILSelector);
  applyPickerFields(m,p);
  // The original decoder deliberately retains historical wp fields when FS
  // decodes false. For this NEW paid request only, use the actual decoded
  // current FS false in the native RF request projection. Never mutate wp,
  // infer false from absence, or manufacture a successful START/PICK ACK.
  const actual=ownIndexedDecode(p),requestModel=currentPaidDATA&&actual.Woa[0]===false?{...m,wp:{...m.wp,sY:actual.Woa[0]}}:m;
  assert(m.H$&&m.ec.Nx===0&&m.wp.L9===true&&firstPickType(requestModel)==='FEATURE_START','AG integrity: own32724 actual picker BET next unmapped');
  return {firstStartPending:true,actualOwnRequest:'FEATURE_START',currentPaidFS0:actual.Woa[0],historicalModelUnchanged:true,requiresNoFurtherWireRequest:false,wholeFeatureCoverageClaimed:false};
 }
 function applyPickerResponse(m:any,p:any,event:string){
  applyPickerFields(m,p);
  if(event==='FEATURE_START'){
   // Own gCa.N_a successful expected-message callback.
   m.wp.sY=true;m.wp.I9=false;
   assert(firstPickType(m)==='FEATURE_PICK','AG integrity: own32724 successful START actual next unmapped');
  }else if(event==='FEATURE_PICK'){
   // Own eCa.vSa successful expected-message callback. Empty/unbound FPM
   // must not be forced into END merely because presentation changed scene.
   m.wp.I9=true;
   assert(firstPickType(m)==='FEATURE_END','AG integrity: own32724 successful PICK actual next unmapped');
  }else assert(event==='FEATURE_END','AG integrity: own32724 unknown picker response');
 }
 function selectFreeAfterEND(m:any):'fg'|'lil'{
  assert(m.Pca===1||m.Pca===2,'AG integrity: own32724 actual END Bonus next unmapped');
  assert(!m.state.Ik&&(m.Pca===1?m.ec.Fe>0:!!m.ec.Fe),'AG integrity: own32724 actual Bonus intro free selector absent');
  betFields(m);return m.Pca===1?'fg':'lil';
 }
 function applySelectedFree(m:any,p:any,mode:'fg'|'lil'):any{
  applyPickerFields(m,p);
  assert(!m.GE,'AG integrity: own32724 free respin transition unmapped');
  if(mode==='fg'){
   // Own EL: no WC picker; IFG and NFG==0 then FID3 routes LIL,
   // otherwise own FGTransitionOut -> bigWin/qa/playFinished/local close.
   if(!m.H$&&m.ec.ho&&m.ec.Fe===0&&Array.isArray(m.xh)&&m.xh[0]!==3&&!m.rJ&&!m.pp)return{ownLifecycleEnd:'FGTransitionOut/qa/playFinished/local-close/idle'};
   assert(m.ec.Fe>0&&!m.state.Ik&&!m.rJ&&!m.pp&&!(m.H$&&m.ec.Nx===0),'AG integrity: own32724 FG actual next or terminal unmapped');
  }else{
   // Own LilSpinFinished -> LilResult only on IFG && NFG==0 && FID3.
   // Source post-close O6 can return to LilFormChain while InLIL && !EG.
   if(m.ec.ho&&m.ec.Fe===0&&Array.isArray(m.xh)&&m.xh[0]===3&&!m.rJ&&(!m.pp||m.qY))return{ownLifecycleEnd:'LilResult/LilTransitionOut/qa/playFinished/local-close/idle'};
   assert(!(m.ec.ho&&m.ec.Fe===0)&&!!m.ec.Fe&&!m.state.Ik&&!(m.H$&&m.ec.Nx===0),'AG integrity: own32724 LIL actual next or terminal unmapped');
  }
  return{actualOwnRequest:'FREE_GAME',ownMode:mode,requiresNoFurtherWireRequest:false};
 }
 return {createModel,initialize,betFields,applyOrdinaryAndRequireActualEnd,applyFirstStartOrOrdinary,applyFirstLILOrPrior,applyPickerBET,applyPickerResponse,selectFreeAfterEND,applySelectedFree};
})();
export function ownLockIt32724Profile(game:AGGameConfig){const c=game.sg?.ownGDMContract,b=c?.ownLockIt32724OrdinaryData;if(b===undefined)return undefined;
 assert(game.provider==='sg'&&game.gameId==='32724'&&game.dbName==='sg_lockitlinkdiamonds96'&&game.backendId==='lockitlinkdiamonds96'&&game.sg.protocol==='gdm'&&game.sg.endpoint==='https://ogs-gdm-usnj.nyxop.net/nextgen/'&&game.sg.runtimeGameId===33124&&game.sg.runtimeSlug==='lockitlinkdiamonds96','AG integrity: own32724 exact identity');
 assert(c.version==='own-LockIt32724-ordinary-input-real-end-v1'&&c.ownSDKFileSHA256===ownLockIt32724Binding.SDKFileSHA256&&c.betRaw===250&&game.sg.betRaw===250&&c.balanceScale===1&&c.winScale===1,'AG integrity: own32724 exact contract');
 if(c.ownLockIt32724LILCurrentSelectorDATA!==undefined)assert(c.ownLockIt32724LILCurrentSelectorDATA==='own32724-current-rJ-pending-NFG-LIL-selector-v1'&&c.ownLockIt32724WholeLILCapture,'AG integrity: own32724 exact current LIL selector DATA'); if(c.ownLockIt32724CurrentPaidPickerDATA!==undefined)assert(c.ownLockIt32724CurrentPaidPickerDATA==='own32724-current-paid-explicit-FS0-request-projection-v1'&&c.ownLockIt32724WholeFGCapture,'AG integrity: own32724 exact current paid picker DATA');if(c.ownLockIt32724WholeFGCapture!==undefined)assert(c.ownLockIt32724WholeFGCapture==='own32724-real-FG-selected-end-whole-round-v1'&&c.ownLockIt32724WholeLILCapture,'AG integrity: own32724 exact whole FG binding');if(c.ownLockIt32724WholeLILCapture!==undefined)assert(c.ownLockIt32724WholeLILCapture==='own32724-real-LIL-selected-end-whole-round-v1'&&c.ownLockIt32724FreeTerminalDiagnostic,'AG integrity: own32724 exact whole LIL binding');if(c.ownLockIt32724FreeTerminalDiagnostic!==undefined)assert(c.ownLockIt32724FreeTerminalDiagnostic==='own32724-selected-free-lifecycle-end-diagnostic-v1'&&c.ownLockIt32724PickerEndDiagnostic,'AG integrity: own32724 exact selected free diagnostic binding');if(c.ownLockIt32724PickerEndDiagnostic!==undefined)assert(c.ownLockIt32724PickerEndDiagnostic==='own32724-picker-START-PICK-END-diagnostic-v1'&&c.ownLockIt32724FirstStartDiagnostic&&c.ownLockIt32724CommonWrapperData,'AG integrity: own32724 exact picker diagnostic binding');if(c.ownLockIt32724CommonWrapperData!==undefined)assert.deepStrictEqual(c.ownLockIt32724CommonWrapperData,{"version":"own32724-parent-wrapper-common-GN-v1","sourceFileSHA256":"38919c7ada28bdf8e665630347ffaf78bc5ae60d5e2e006d7ce97e56656d280c","gameNameFromOwnRuntimeSlug":true},'AG integrity: own32724 exact common wrapper binding');assert(c.ownLockIt32724FirstLILDiagnostic===undefined||c.ownLockIt32724FirstLILDiagnostic==='own32724-first-LIL-diagnostic-v1','AG integrity: own32724 LIL diagnostic binding');assert(c.ownLockIt32724FirstStartDiagnostic===undefined||c.ownLockIt32724FirstStartDiagnostic==='own32724-first-start-diagnostic-v1','AG integrity: own32724 diagnostic binding');assert.deepStrictEqual(b,ownLockIt32724Binding,'AG integrity: own32724 fixed source binding');assert.deepStrictEqual(game.sg.requestParams,{GN:'lockitlinkdiamonds96',AP:'false',BPL:'5',LB:'50'},'AG integrity: own32724 actual paid input');return c;}
// own32769 Node Init registration: same module and private WeakMaps.
{
  const {installOwn32769NodeInit} =
    require("./own32769-node-init-register.cjs");
  installOwn32769NodeInit({bindOwn32769InitDataFactory});
}

// Own protocol DATA registration only; original AG provider entry/scheduler/round/Mongo stay byte-identical.
require("./own32536-native-register.cjs");

// Own32727 manifest/connection/protocol DATA, using the same SG module and WeakMaps.
require("./own32727-native-data/register.cjs").registerOwn32727NativeDATA(module.exports);
