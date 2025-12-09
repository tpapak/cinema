module ClinImp.Model where

import Prelude
import Effect
import Data.Argonaut.Core (Json)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Argonaut.Types.Generic (defaultEncoding)
import Data.Generic.Rep as Rep
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
import Data.Tuple

import EffectMeasure (isRatio, EffectMeasureType (..) )



-- ClinImp <
newtype ClinImp = ClinImp
  { status :: String
  , question :: String
  , baseValue :: Number
  , upperBound :: Number
  , lowerBound :: Number
  , emtype :: EffectMeasureType
  }
derive instance genericClinImp :: Rep.Generic ClinImp _
instance showClinImp :: Show ClinImp where
    show = genericShow
instance decodeClinImp :: DecodeJson ClinImp where
  decodeJson = genericDecodeJson

readClinImp :: Json -> Either JsonDecodeError ClinImp
readClinImp = genericDecodeJson

_ClinImp :: Lens' ClinImp (Record _)
_ClinImp = lens (\(ClinImp s) -> s) (\_ -> ClinImp)
{----}
{--baseValue :: forall a b r. Lens { baseValue :: a | r } { baseValue :: b | r } a b--}
{--baseValue = prop (Proxy :: Proxy "baseValue")--}
{----}
{--emtype :: forall a b r. Lens { emtype :: a | r } { emtype :: b | r } a b--}
{--emtype = prop (Proxy :: Proxy "emtype")--}
{----}
getDefaultMeasure :: EffectMeasureType -> Number
getDefaultMeasure a
  | isRatio a = 1.0
  | otherwise = 0.0

newtype SanitizedClinImp = SanitizedClinImp
  { status :: String
  , question :: String
  , baseValue :: Number
  , upperBound :: Number
  , lowerBound :: Number
  , emtype :: String
  }

sanitizeClinImp :: ClinImp -> SanitizedClinImp
sanitizeClinImp ci =
  let emt = show $ (ci ^. _ClinImp)."emtype"
  in SanitizedClinImp ((ci ^. _ClinImp) { emtype = emt })

emptyClinImp :: ClinImp
emptyClinImp = ClinImp
  { status : "not_ready"
  , question : "Define threshold of clinical importance"
  , baseValue : -2.0
  , upperBound : -4.0
  , lowerBound : -4.0
  , emtype : RR
  }

skeletonClinImp :: EffectMeasureType -> ClinImp
skeletonClinImp m =
  let default = getDefaultMeasure m
  in ClinImp
    { status : "not_set"
    , question : "Define threshold of clinical importance"
    , baseValue : default
    , upperBound : default
    , lowerBound : default
    , emtype : m
    }
