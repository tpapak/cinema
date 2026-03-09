module Text.Model where

import Prelude
import Effect
import Data.Argonaut.Decode
import Data.Argonaut.Core (toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Decode.Combinators (getField)
-- -- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
-- import Data.Argonaut.Gen (genericDecode) -- REMOVED
import Data.Generic.Rep as Rep
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Maybe (Maybe(..))
import Data.Either (Either(..))
import Data.Int
import Data.Newtype
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)

-- RoBLevel <
newtype TextContent = TextContent
  { "NetRob" :: NetRobText
  , errorPage :: String
  , "Report" :: ReportText
  , "ClinImp" :: ClinImpText
  , "Heterogeneity" :: HeterogeneityText
  , "Imprecision" :: ImprecisionText
  , "NetIndr" :: IndirectnessText
  , "Pubbias" :: PubbiasText
  }

derive instance genericTextContent :: Rep.Generic TextContent _
instance showTextContent :: Show TextContent where
  show = genericShow

instance decodeTextContent :: DecodeJson TextContent where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      netRob <- getField obj "NetRob"
      errorPg <- getField obj "errorPage"
      report <- getField obj "Report"
      clinImp <- getField obj "ClinImp"
      heter <- getField obj "Heterogeneity"
      impr <- getField obj "Imprecision"
      netIndr <- getField obj "NetIndr"
      pubbias <- getField obj "Pubbias"
      pure $ TextContent
        { "NetRob": netRob
        , errorPage: errorPg
        , "Report": report
        , "ClinImp": clinImp
        , "Heterogeneity": heter
        , "Imprecision": impr
        , "NetIndr": netIndr
        , "Pubbias": pubbias
        }

_TextContent :: Lens' TextContent (Record _)
_TextContent = lens (\(TextContent s) -> s) (\_ -> TextContent)

netRobText :: forall a b r. Lens { "NetRob" :: a | r } { "NetRob" :: b | r } a b
netRobText = prop (Proxy :: Proxy "NetRob")

reportText :: forall a b r. Lens { "Report" :: a | r } { "Report" :: b | r } a b
reportText = prop (Proxy :: Proxy "Report")

clinImpText :: forall a b r. Lens { "ClinImp" :: a | r } { "ClinImp" :: b | r } a b
clinImpText = prop (Proxy :: Proxy "ClinImp")

heterogeneityText :: forall a b r. Lens { "Heterogeneity" :: a | r } { "Heterogeneity" :: b | r } a b
heterogeneityText = prop (Proxy :: Proxy "Heterogeneity")

imprecisionText :: forall a b r. Lens { "Imprecision" :: a | r } { "Imprecision" :: b | r } a b
imprecisionText = prop (Proxy :: Proxy "Imprecision")

indirectnessText :: forall a b r. Lens { "NetIndr" :: a | r } { "NetIndr" :: b | r } a b
indirectnessText = prop (Proxy :: Proxy "NetIndr")

pubbiasText :: forall a b r. Lens { "Pubbias" :: a | r } { "Pubbias" :: b | r } a b
pubbiasText = prop (Proxy :: Proxy "Pubbias")

-- TextContent >

-- ClinImpText <
newtype ClinImpText = ClinImpText
  { question :: String
  }

derive instance genericClinImpText :: Rep.Generic ClinImpText _
instance showClinImpText :: Show ClinImpText where
  show = genericShow

instance decodeClinImpText :: DecodeJson ClinImpText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      q <- getField obj "question"
      pure $ ClinImpText { question: q }

_ClinImpText :: Lens' ClinImpText (Record _)
_ClinImpText = lens (\(ClinImpText s) -> s) (\_ -> ClinImpText)

--ClinImpText >

-- NetRobText <
newtype NetRobText = NetRobText
  { rules :: RuleTexts
  }

derive instance genericNetRobText :: Rep.Generic NetRobText _
instance showNetRobText :: Show NetRobText where
  show = genericShow

instance decodeNetRobText :: DecodeJson NetRobText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      r <- getField obj "rules"
      pure $ NetRobText { rules: r }

_NetRobText :: Lens' NetRobText (Record _)
_NetRobText = lens (\(NetRobText s) -> s) (\_ -> NetRobText)

netRobRulesText :: forall a b r. Lens { rules :: a | r } { rules :: b | r } a b
netRobRulesText = prop (Proxy :: Proxy "rules")

--NetRobText >

-- HeterogeneityText <
newtype HeterogeneityText = HeterogeneityText
  { levels :: Array String
  }

derive instance genericHeterogeneityText :: Rep.Generic HeterogeneityText _
instance showHeterogeneityText :: Show HeterogeneityText where
  show = genericShow

instance decodeHeterogeneityText :: DecodeJson HeterogeneityText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lvls <- getField obj "levels"
      pure $ HeterogeneityText { levels: lvls }

_HeterogeneityText :: Lens' HeterogeneityText (Record _)
_HeterogeneityText = lens (\(HeterogeneityText s) -> s) (\_ -> HeterogeneityText)

--HeterogeneityText >

-- ImprecisionText <
newtype ImprecisionText = ImprecisionText
  { levels :: Array String
  }

derive instance genericImprecisionText :: Rep.Generic ImprecisionText _
instance showImprecisionText :: Show ImprecisionText where
  show = genericShow

instance decodeImprecisionText :: DecodeJson ImprecisionText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lvls <- getField obj "levels"
      pure $ ImprecisionText { levels: lvls }

_ImprecisionText :: Lens' ImprecisionText (Record _)
_ImprecisionText = lens (\(ImprecisionText s) -> s) (\_ -> ImprecisionText)

--ImprecisionText >

-- IndirectnessText <
newtype IndirectnessText = IndirectnessText
  { levels :: Array String
  }

derive instance genericIndirectnessText :: Rep.Generic IndirectnessText _
instance showIndirectnessText :: Show IndirectnessText where
  show = genericShow

instance decodeIndirectnessText :: DecodeJson IndirectnessText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lvls <- getField obj "levels"
      pure $ IndirectnessText { levels: lvls }

_IndirectnessText :: Lens' IndirectnessText (Record _)
_IndirectnessText = lens (\(IndirectnessText s) -> s) (\_ -> IndirectnessText)

--IndirectnessText >

-- PubbiasText <
newtype PubbiasText = PubbiasText
  { levels :: Array String
  }

derive instance genericPubbiasText :: Rep.Generic PubbiasText _
instance showPubbiasText :: Show PubbiasText where
  show = genericShow

instance decodePubbiasText :: DecodeJson PubbiasText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lvls <- getField obj "levels"
      pure $ PubbiasText { levels: lvls }

_PubbiasText :: Lens' PubbiasText (Record _)
_PubbiasText = lens (\(PubbiasText s) -> s) (\_ -> PubbiasText)

--PubbiasText >

-- RuleTextx <
newtype RuleTexts = RuleTexts
  { majRule :: String
  , maxRule :: String
  , meanRule :: String
  , noRule :: String
  }

derive instance genericRuleTexts :: Rep.Generic RuleTexts _
instance showRuleTexts :: Show RuleTexts where
  show = genericShow

instance decodeRuleTexts :: DecodeJson RuleTexts where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      maj <- getField obj "majRule"
      mx <- getField obj "maxRule"
      mn <- getField obj "meanRule"
      no <- getField obj "noRule"
      pure $ RuleTexts { majRule: maj, maxRule: mx, meanRule: mn, noRule: no }

_RuleTexts :: Lens' RuleTexts (Record _)
_RuleTexts = lens (\(RuleTexts s) -> s) (\_ -> RuleTexts)

getNetRobRuleText :: String -> RuleTexts -> String
getNetRobRuleText rule texts = do
  let tr = texts ^. _RuleTexts
  let
    ruletext = case rule of
      "majRule" -> tr."majRule"
      "maxRule" -> tr."maxRule"
      "meanRule" -> tr."meanRule"
      otherwise -> tr."noRule"
  ruletext

-- ReportText <
newtype ReportText = ReportText
  { levels :: Array String
  }

derive instance genericReportText :: Rep.Generic ReportText _
instance showReportText :: Show ReportText where
  show = genericShow

instance decodeReportText :: DecodeJson ReportText where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      lvls <- getField obj "levels"
      pure $ ReportText { levels: lvls }

_ReportText :: Lens' ReportText (Record _)
_ReportText = lens (\(ReportText s) -> s) (\_ -> ReportText)

reportRulesText :: forall a b r. Lens { levels :: a | r } { levels :: b | r } a b
reportRulesText = prop (Proxy :: Proxy "levels")
--NetRobText >
