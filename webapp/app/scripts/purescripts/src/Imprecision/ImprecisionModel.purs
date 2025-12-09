module ImprecisionModel where

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


-- Imprecision <
newtype Imprecision = Imprecision
    { status :: String
    , boxes :: Array ImprecisionBox
    }
_Imprecision :: Lens' Imprecision (Record _)
_Imprecision = lens (\(Imprecision s) -> s) (\_ -> Imprecision)
derive instance genericImprecision :: Rep.Generic Imprecision _
instance showImprecision :: Show Imprecision where
    show = genericShow
instance decodeImprecision :: DecodeJson Imprecision where
  decodeJson = genericDecodeJson
-- Imprecision >

-- ImprecisionBox <
newtype ImprecisionBox = ImprecisionBox
    { id :: String
    , judgement :: Int
    , label :: String
    , levels :: Array ImprecisionLevel
    , color :: String
    , ruleLevel :: Int
    , customized :: Boolean
    }
derive instance genericImprecisionBox :: Rep.Generic ImprecisionBox _
_ImprecisionBox :: Lens' ImprecisionBox (Record _)
_ImprecisionBox = lens (\(ImprecisionBox s) -> s) (\_ -> ImprecisionBox)
instance showImprecisionBox :: Show ImprecisionBox where
    show = genericShow

skeletonImprecisionBox = ImprecisionBox { id : "None"
                                        , judgement : -1
                                        , label : "--"
                                        , levels : []
                                        , color : ""
                                        , ruleLevel : -1
                                        , customized : false
                                        }
instance decodeImprecisionBox :: DecodeJson ImprecisionBox where
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
      pure $ ImprecisionBox { id
                              , levels
                              , judgement
                              , ruleLevel
                              , label
                              , customized
                              , color }
imprecisionboxlabel :: forall a b r. Lens { label :: a | r } { label :: b | r } a b
imprecisionboxlabel = prop (Proxy :: Proxy "label")
imprecisionboxcolor :: forall a b r. Lens { color :: a | r } { color :: b | r } a b
imprecisionboxcolor = prop (Proxy :: Proxy "color")
imprecisionboxcustomized :: forall a b r. Lens { customized :: a | r } { customized :: b | r } a b
imprecisionboxcustomized = prop (Proxy :: Proxy "customized")


{--type StringComparisonIds = Array String--}
  
{--instance decodeStringComparisonIds :: DecodeJson StringComparisonIds where--}
  {--decode = genericDecodeJson--}
-- ImprecisionBox >


-- ImprecisionLevel <
newtype ImprecisionLevel = ImprecisionLevel
    { id :: Int
    , color :: String
    }
_ImprecisionLevel :: Lens' ImprecisionLevel (Record _)
_ImprecisionLevel = lens (\(ImprecisionLevel s) -> s) (\_ -> ImprecisionLevel)
derive instance genericImprecisionLevel :: Rep.Generic ImprecisionLevel _
instance showImprecisionLevel :: Show ImprecisionLevel where
    show = genericShow
instance decodeImprecisionLevel :: DecodeJson ImprecisionLevel where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      color <- getField obj "color"
      pure $ ImprecisionLevel { id
                                , color }
-- ImprecisionLevel >
