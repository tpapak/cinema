module Model where

import Prelude
import Effect
import Data.Array
import Data.Argonaut
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.Maybe
import Data.Either (Either(..))
import Data.Int
import Data.Newtype
import Data.String as S
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)

import Text.Model
import ComparisonModel
import StudyLimitationsModel
import IndirectnessModel
import InconsistencyModel
import ClinImp.Model
import EffectMeasure
import ImprecisionModel
import PubbiasModel
import Report.Model


-- State <
newtype State = State
  { project :: Project
  , text :: TextContent
  }
_State :: Lens' State (Record _)
_State = lens (\(State s) -> s) (\_ -> State)
derive instance genericState :: Rep.Generic State _
instance showState :: Show State where
    show = genericShow
instance decodeState :: DecodeJson State where
  decodeJson = genericDecodeJson
getState :: Json -> Either JsonDecodeError State
getState = genericDecodeJson
project :: forall a b r. Lens { project :: a | r } { project :: b | r } a b
project = prop (Proxy :: Proxy "project")
text :: forall a b r. Lens { text :: a | r } { text :: b | r } a b
text = prop (Proxy :: Proxy "text")

readState :: Json -> Either String State
readState m = 
  case getState m of
   Left a -> Left (show a)
   Right b -> Right b
-- State >

-- Project <
newtype Project = Project
  { title :: String
  , format :: String
  , "type" :: String
  , accessDate :: Int
  , creationDate :: Int
  , studyLimitationLevels :: Array RoBLevel
  , studies :: Studies
  , "CM" :: CMContainer
  , netRob :: NetRobModel
  , clinImp :: ClinImp
  , heterogeneity :: Heterogeneity
  , incoherence :: Incoherence
  , indirectness :: Indirectness
  , imprecision :: Imprecision
  , pubbias :: Pubbias
  , report :: Report
  }
derive instance genericProject :: Rep.Generic Project _
instance showProject :: Show Project where
    show = genericShow
instance decodeProject :: DecodeJson Project where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      title <- getField obj "title"
      format <- getField obj "format"
      tp <- getField obj "type"
      creationDate <- pure floor <*> getField obj "creationDate"
      accessDate <- pure floor <*> getField obj "accessDate"
      studyLimitationLevels <- getField obj "studyLimitationLevels"
      studies <- getField obj "studies"
      cm <- getField obj "CM"
      netRob <- getField obj "netRob"
      imprecision <- getField obj "imprecision"
      indrJson <- getField obj "indirectness"
      indrObj <- case toObject indrJson of
        Nothing -> Left $ TypeMismatch "Object"
        Just o -> Right o
      indirectness <- getField indrObj "netindr"
      heterogeneity <- getField obj "heterogeneity"
      incoherence <- getField obj "incoherence"
      clinImp <- getField obj "clinImp"
      pubbias <- getField obj "pubbias"
      report <- getField obj "report"
      pure $ Project { title
                   , format
                   , "type" : tp
                   , creationDate
                   , accessDate
                   , studyLimitationLevels
                   , studies
                   , "CM" : cm
                   , netRob
                   , indirectness
                   , clinImp
                   , imprecision
                   , heterogeneity
                   , incoherence
                   , pubbias
                   , report}
_Project :: Lens' Project (Record _)
_Project = lens (\(Project s) -> s) (\_ -> Project)
netRob :: forall a b r. Lens { netRob :: a | r } { netRob :: b | r } a b
netRob = prop (Proxy :: Proxy "netRob")
inconsistency :: forall a b r. Lens { inconsistency :: a | r } { inconsistency :: b | r } a b
inconsistency = prop (Proxy :: Proxy "inconsistency")
imprecision :: forall a b r. Lens { imprecision :: a | r } { imprecision :: b | r } a b
imprecision = prop (Proxy :: Proxy "imprecision")
indirectness :: forall a b r. Lens { indirectness :: a | r } { indirectness :: b | r } a b
indirectness = prop (Proxy :: Proxy "indirectness")
heterogeneity :: forall a b r. Lens { heterogeneity :: a | r } { heterogeneity :: b | r } a b
heterogeneity = prop (Proxy :: Proxy "heterogeneity")
incoherence :: forall a b r. Lens { incoherence :: a | r } { incoherence :: b | r } a b
incoherence = prop (Proxy :: Proxy "incoherence")
pubbias :: forall a b r. Lens { pubbias :: a | r } { pubbias :: b | r } a b
pubbias = prop (Proxy :: Proxy "pubbias")
clinImp :: forall a b r. Lens { clinImp :: a | r } { clinImp :: b | r } a b
clinImp = prop (Proxy :: Proxy "clinImp")
studies :: forall a b r. Lens { studies :: a | r } { studies :: b | r } a b
studies = prop (Proxy :: Proxy "studies")
cmContainer :: forall a b r. Lens { "CM" :: a | r } { "CM" :: b | r } a b
cmContainer = prop (Proxy :: Proxy "CM")

hasConMat :: State -> Boolean
hasConMat st = (st ^. _State <<< project <<< _Project
                    <<< cmContainer <<< _CMContainer
                    <<< currentCM <<< _ContributionMatrix)
                   ."status" == "ready"
-- Project >
-- Studies <
newtype Studies = Studies
  { directComparisons :: Array Comparison
  , indirectComparisons :: Array String
  , nodes :: Array Node
  }
derive instance genericStudies :: Rep.Generic Studies _
instance showStudies :: Show Studies where
    show = genericShow
instance decodeStudies :: DecodeJson Studies where
  decodeJson = genericDecodeJson
_Studies :: Lens' Studies (Record _)
_Studies = lens (\(Studies s) -> s) (\_ -> Studies)
directComparisons :: forall a b r. Lens { directComparisons :: a | r } {
  directComparisons :: b | r } a b
directComparisons = prop (Proxy :: Proxy "directComparisons" )
indirectComparisons :: forall a b r. Lens { indirectComparisons :: a | r } {
  indirectComparisons :: b | r } a b
indirectComparisons = prop (Proxy :: Proxy "indirectComparisons" )
-- Studies >

-- CMContainer <
newtype CMContainer = CMContainer
  { currentCM :: ContributionMatrix
  }
derive instance genericCMContainer :: Rep.Generic CMContainer _
instance showCMContainer :: Show CMContainer where
    show = genericShow
instance decodeCMContainer :: DecodeJson CMContainer where
  decodeJson = genericDecodeJson
_CMContainer :: Lens' CMContainer (Record _)
_CMContainer = lens (\(CMContainer s) -> s) (\_ -> CMContainer)
currentCM :: forall a b r. Lens { currentCM :: a | r } { currentCM :: b | r } a b
currentCM = prop (Proxy :: Proxy "currentCM" )
-- CMContainer >

-- ContributionMatrix <
newtype ContributionMatrix = ContributionMatrix
  { status :: String
  , colNames :: Array String
  , directRowNames :: Array String
  , indirectRowNames :: Array String
  , params :: CMParameters
  , selectedComparisons :: Array String
  }
derive instance genericContributionMatrix :: Rep.Generic ContributionMatrix _
instance showContributionMatrix :: Show ContributionMatrix where
    show = genericShow
instance decodeContributionMatrix :: DecodeJson ContributionMatrix where
  decodeJson = genericDecodeJson
_ContributionMatrix :: Lens' ContributionMatrix (Record _)
_ContributionMatrix = lens (\(ContributionMatrix s) -> s) (\_ -> ContributionMatrix)
params :: forall a b r. Lens { params :: a | r } { params :: b | r } a b
params = prop (Proxy :: Proxy "params")

getSelected :: State -> Array String
getSelected st = (st  ^. _State <<< project <<< _Project
                 <<< cmContainer <<< _CMContainer
                 <<< currentCM <<< _ContributionMatrix)."selectedComparisons"
-- ContributionMatrix >


-- CMParameters <
newtype CMParameters = CMParameters
  { "MAModel" :: String
    , intvs :: Array String
    , rule :: String
    , sm :: EffectMeasureType
  }
derive instance genericCMParameters :: Rep.Generic CMParameters _
instance showCMParameters :: Show CMParameters where
    show = genericShow
instance decodeCMParameters :: DecodeJson CMParameters where
  decodeJson = genericDecodeJson
_CMParameters :: Lens' CMParameters (Record _)
_CMParameters = lens (\(CMParameters s) -> s) (\_ -> CMParameters)

getEffectMeasureType :: State -> EffectMeasureType
getEffectMeasureType st = (st ^. _State <<< project <<< _Project
                          <<< cmContainer <<< _CMContainer
                          <<< currentCM <<< _ContributionMatrix
                          <<< params <<< _CMParameters
                          )."sm"
-- CMParameters >

