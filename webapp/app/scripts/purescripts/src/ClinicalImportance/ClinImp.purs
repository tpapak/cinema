module ClinImp where

import Prelude
import Data.Maybe (Maybe(..))
import Data.Either (Either(..))
import Effect (Effect)
import Effect.Console (log, logShow)
import Control.Monad.Except (runExcept)
import Data.Argonaut.Core (Json)
import Data.Argonaut.Decode.Class (decodeJson)
import Data.Argonaut.Decode.Error (JsonDecodeError)
import Data.Argonaut.Encode.Class (encodeJson)
import Data.Newtype
import Data.Number
import Data.Lens
import Data.Lens.Fold
import Data.Lens.Fold.Partial
import Data.Lens.Grate
import Data.Lens.Index
import Data.Lens.Lens
import Data.Lens.Record
import Data.Lens.Setter
import Data.Lens.Zoom
import Data.Tuple

import Model
import EffectMeasure
import ClinImp.Model
import SaveModel

isValid :: Json -> Json -> Json
isValid fci fbv = do
  let
    eci = readClinImp fci
    ebv = decodeJson fbv
  case eci of
    Left _ -> encodeJson $ Tuple "Could read State" false
    Right ci -> do
      let ir = isRatio $ (ci ^. _ClinImp)."emtype"
      case ebv of
        Left er -> encodeJson $ Tuple "Couldn't read Value" false
        Right bv
          | isNaN bv -> encodeJson $ Tuple "not a number" false
          | ir && bv < 0.0 -> encodeJson $ Tuple "< 0 for ratio measure" false
          | otherwise -> encodeJson $ Tuple "Success" true

showValid :: Json -> Json -> Effect Unit
showValid fci fbv = do
  let
    eci = readClinImp fci
    ebv = decodeJson fbv :: Either JsonDecodeError Number
  case eci of
    Left er -> logShow $ "error reading clin imp" <> show er
    Right ci -> logShow $ "read clin Imp correctly" <> show ci

