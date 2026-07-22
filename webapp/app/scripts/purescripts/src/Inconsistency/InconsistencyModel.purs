module InconsistencyModel where

import Prelude
import Effect
import Data.Array
import Data.Argonaut.Core (Json, toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Maybe
import Data.Either
import Data.Int
import Data.Newtype
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)

import Text.Model
import ComparisonModel

-- Heterogeneity <
newtype Heterogeneity = Heterogeneity
  { heters :: Heters
  , referenceValues :: ReferenceValues
  }

_Heterogeneity :: Lens' Heterogeneity (Record _)
_Heterogeneity = lens (\(Heterogeneity s) -> s) (\_ -> Heterogeneity)

derive instance genericHeterogeneity :: Rep.Generic Heterogeneity _
instance showHeterogeneity :: Show Heterogeneity where
  show = genericShow

instance decodeHeterogeneity :: DecodeJson Heterogeneity where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      h <- getField obj "heters"
      rv <- getField obj "referenceValues"
      pure $ Heterogeneity { heters: h, referenceValues: rv }

heters :: forall a b r. Lens { heters :: a | r } { heters :: b | r } a b
heters = prop (Proxy :: Proxy "heters")

referenceValues :: forall a b r. Lens { referenceValues :: a | r } { referenceValues :: b | r } a b
referenceValues = prop (Proxy :: Proxy "referenceValues")

-- Heterogeneity >

newtype Heters = Heters
  { status :: String
  , boxes :: Array HeterogeneityBox
  }

_Heters :: Lens' Heters (Record _)
_Heters = lens (\(Heters s) -> s) (\_ -> Heters)

derive instance genericHeters :: Rep.Generic Heters _
instance showHeters :: Show Heters where
  show = genericShow

instance decodeHeters :: DecodeJson Heters where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      st <- getField obj "status"
      b <- getField obj "boxes"
      pure $ Heters { status: st, boxes: b }

newtype ReferenceValues = ReferenceValues
  { status :: String
  , treatments :: Array Node
  }

_ReferenceValues :: Lens' ReferenceValues (Record _)
_ReferenceValues = lens (\(ReferenceValues s) -> s) (\_ -> ReferenceValues)

derive instance genericReferenceValues :: Rep.Generic ReferenceValues _
instance showReferenceValues :: Show ReferenceValues where
  show = genericShow

instance decodeReferenceValues :: DecodeJson ReferenceValues where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      st <- getField obj "status"
      t <- getField obj "treatments"
      pure $ ReferenceValues { status: st, treatments: t }

newtype HeterogeneityBox = HeterogeneityBox
  { id :: String
  , judgement :: Int
  , label :: String
  , levels :: Array HeterogeneityLevel
  , color :: String
  , ruleLevel :: Int
  , customized :: Boolean
  }

_HeterogeneityBox :: Lens' HeterogeneityBox (Record _)
_HeterogeneityBox = lens (\(HeterogeneityBox s) -> s) (\_ -> HeterogeneityBox)

derive instance genericHeterogeneityBox :: Rep.Generic HeterogeneityBox _
instance showHeterogeneityBox :: Show HeterogeneityBox where
  show = genericShow

skeletonHeterogeneityBox = HeterogeneityBox
  { id: "None"
  , judgement: -1
  , label: "--"
  , levels: []
  , color: ""
  , ruleLevel: -1
  , customized: false
  }

{--instance decodeHeterogeneityBox :: DecodeJson HeterogeneityBox where--}
{--decode = genericDecodeJson--}
instance decodeHeterogeneityBox :: DecodeJson HeterogeneityBox where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      -- judgement <- getField obj "judgement"   -- strict: crashed on 'nothing'/null/fraction
      let judgement = case (getField obj "judgement" :: Either JsonDecodeError Int) of
                        Left _  -> (-1)
                        Right v -> v
      -- ruleLevel <- getField obj "ruleLevel"
      let ruleLevel = case (getField obj "ruleLevel" :: Either JsonDecodeError Int) of
                        Left _  -> (-1)
                        Right v -> v
      levels <- getField obj "levels"
      let color = ""
      let label = "--"
      customized <- pure false
      pure $ HeterogeneityBox
        { id
        , levels
        , judgement
        , ruleLevel
        , label
        , customized
        , color
        }

heterboxlabel :: forall a b r. Lens { label :: a | r } { label :: b | r } a b
heterboxlabel = prop (Proxy :: Proxy "label")

heterboxcolor :: forall a b r. Lens { color :: a | r } { color :: b | r } a b
heterboxcolor = prop (Proxy :: Proxy "color")

heterboxcustomized :: forall a b r. Lens { customized :: a | r } { customized :: b | r } a b
heterboxcustomized = prop (Proxy :: Proxy "customized")

{--type StringComparisonIds = Array String--}

{--instance decodeStringComparisonIds :: DecodeJson StringComparisonIds where--}
{--decode = genericDecodeJson--}

newtype HeterogeneityLevel = HeterogeneityLevel
  { id :: Int
  , color :: String
  }

_HeterogeneityLevel :: Lens' HeterogeneityLevel (Record _)
_HeterogeneityLevel = lens (\(HeterogeneityLevel s) -> s) (\_ -> HeterogeneityLevel)

derive instance genericHeterogeneityLevel :: Rep.Generic HeterogeneityLevel _
instance showHeterogeneityLevel :: Show HeterogeneityLevel where
  show = genericShow

{--instance decodeHeterogeneityLevel :: DecodeJson HeterogeneityLevel where--}
{--decode = genericDecodeJson--}
instance decodeHeterogeneityLevel :: DecodeJson HeterogeneityLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      color <- getField obj "color"
      pure $ HeterogeneityLevel
        { id
        , color
        }

-- Incoherence <
newtype Incoherence = Incoherence
  { status :: String
  , boxes :: Array IncoherenceBox
  }

_Incoherence :: Lens' Incoherence (Record _)
_Incoherence = lens (\(Incoherence s) -> s) (\_ -> Incoherence)

derive instance genericIncoherence :: Rep.Generic Incoherence _
instance showIncoherence :: Show Incoherence where
  show = genericShow

instance decodeIncoherence :: DecodeJson Incoherence where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      st <- getField obj "status"
      b <- getField obj "boxes"
      pure $ Incoherence { status: st, boxes: b }

-- Incoherence >

-- IncoherenceBox <
newtype IncoherenceBox = IncoherenceBox
  { id :: String
  , judgement :: Int
  , label :: String
  , levels :: Array IncoherenceLevel
  , color :: String
  , ruleJudgement :: Int
  , customized :: Boolean
  }

_IncoherenceBox :: Lens' IncoherenceBox (Record _)
_IncoherenceBox = lens (\(IncoherenceBox s) -> s) (\_ -> IncoherenceBox)

derive instance genericIncoherenceBox :: Rep.Generic IncoherenceBox _
instance showIncoherenceBox :: Show IncoherenceBox where
  show = genericShow

instance decodeIncoherenceBox :: DecodeJson IncoherenceBox where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      -- j <- getField obj "judgement"   -- strict: crashed on 'nothing'/null/fraction
      let j = case (getField obj "judgement" :: Either JsonDecodeError Int) of
                Left _  -> (-1)
                Right v -> v
      l <- getField obj "label"
      lvls <- getField obj "levels"
      c <- getField obj "color"
      -- rj <- getField obj "ruleJudgement"
      let rj = case (getField obj "ruleJudgement" :: Either JsonDecodeError Int) of
                 Left _  -> (-1)
                 Right v -> v
      cust <- getField obj "customized"
      pure $ IncoherenceBox { id: i, judgement: j, label: l, levels: lvls, color: c, ruleJudgement: rj, customized: cust }

skeletonIncoherenceBox = IncoherenceBox
  { id: "None"
  , judgement: -1
  , label: "--"
  , levels: []
  , color: ""
  , ruleJudgement: -1
  , customized: false
  }

-- IncoherenceBox >

-- IncoherenceLevel <
newtype IncoherenceLevel = IncoherenceLevel
  { id :: Int
  , label :: String
  , isActive :: Boolean
  , color :: String
  }

_IncoherenceLevel :: Lens' IncoherenceLevel (Record _)
_IncoherenceLevel = lens (\(IncoherenceLevel s) -> s) (\_ -> IncoherenceLevel)

derive instance genericIncoherenceLevel :: Rep.Generic IncoherenceLevel _
instance showIncoherenceLevel :: Show IncoherenceLevel where
  show = genericShow

instance decodeIncoherenceLevel :: DecodeJson IncoherenceLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      i <- getField obj "id"
      l <- getField obj "label"
      ia <- getField obj "isActive"
      c <- getField obj "color"
      pure $ IncoherenceLevel { id: i, label: l, isActive: ia, color: c }
-- IncoherenceLevel >

