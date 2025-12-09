module IndirectnessModel where

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


-- Indirectness <
newtype Indirectness = Indirectness
    { status :: String
    , boxes :: Array IndirectnessBox
    }
_Indirectness :: Lens' Indirectness (Record _)
_Indirectness = lens (\(Indirectness s) -> s) (\_ -> Indirectness)
derive instance genericIndirectness :: Rep.Generic Indirectness _
instance showIndirectness :: Show Indirectness where
    show = genericShow
instance decodeIndirectness :: DecodeJson Indirectness where
  decodeJson = genericDecodeJson
-- Indirectness >

-- IndirectnessBox <
newtype IndirectnessBox = IndirectnessBox
    { id :: String
    , judgement :: Int
    , label :: String
    , levels :: Array IndirectnessLevel
    , color :: String
    , ruleLevel :: Int
    , customized :: Boolean
    }
_IndirectnessBox :: Lens' IndirectnessBox (Record _)
_IndirectnessBox = lens (\(IndirectnessBox s) -> s) (\_ -> IndirectnessBox)
derive instance genericIndirectnessBox :: Rep.Generic IndirectnessBox _
instance showIndirectnessBox :: Show IndirectnessBox where
    show = genericShow
skeletonIndirectnessBox = IndirectnessBox { id : "None"
                                        , judgement : -1
                                        , label : "--"
                                        , levels : []
                                        , color : ""
                                        , ruleLevel : -1
                                        , customized : false
                                        }
instance decodeIndirectnessBox :: DecodeJson IndirectnessBox where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      judgement <- getField obj "judgement"
      ruleLevel <- getField obj "ruleLevel"
      levels <- getField obj "levels"
      let color = ""
      let label = "--"
      customized <- pure false
      pure $ IndirectnessBox { id
                              , levels
                              , judgement
                              , ruleLevel
                              , label
                              , customized
                              , color }
indirectnessboxlabel :: forall a b r. Lens { label :: a | r } { label :: b | r } a b
indirectnessboxlabel = prop (Proxy :: Proxy "label")
indirectnessboxcolor :: forall a b r. Lens { color :: a | r } { color :: b | r } a b
indirectnessboxcolor = prop (Proxy :: Proxy "color")
indirectnessboxcustomized :: forall a b r. Lens { customized :: a | r } { customized :: b | r } a b
indirectnessboxcustomized = prop (Proxy :: Proxy "customized")


{--type StringComparisonIds = Array String--}
  
{--instance decodeStringComparisonIds :: DecodeJson StringComparisonIds where--}
  {--decode = genericDecodeJson--}
-- IndirectnessBox >


-- IndirectnessLevel <
newtype IndirectnessLevel = IndirectnessLevel
    { id :: Int
    , color :: String
    }
_IndirectnessLevel :: Lens' IndirectnessLevel (Record _)
_IndirectnessLevel = lens (\(IndirectnessLevel s) -> s) (\_ -> IndirectnessLevel)
derive instance genericIndirectnessLevel :: Rep.Generic IndirectnessLevel _
instance showIndirectnessLevel :: Show IndirectnessLevel where
    show = genericShow
instance decodeIndirectnessLevel :: DecodeJson IndirectnessLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      color <- getField obj "color"
      pure $ IndirectnessLevel { id
                                , color }
-- IndirectnessLevel >
