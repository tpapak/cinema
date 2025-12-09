module ComparisonModel where

import Prelude
import Effect 
import Effect.Console (log, logShow)
import Data.Array
import Data.Argonaut.Core (Json, toObject)
import Data.Argonaut.Decode.Error (JsonDecodeError(..))
import Data.Argonaut.Decode.Combinators (getField)
import Data.Argonaut.Decode.Class (class DecodeJson, decodeJson)
import Data.Argonaut.Encode.Class (class EncodeJson, encodeJson)
-- import Data.Argonaut.Index ((!)) -- REMOVED: Use getField from Data.Argonaut
import Data.Argonaut.Decode.Generic (genericDecodeJson)
import Data.Generic.Rep as Rep 
import Data.Show.Generic (genericShow)
import Control.Monad.Except (runExcept)
import Data.List.Types
import Data.Maybe
import Data.Either (Either(..))
import Data.Int (fromString, floor) as Int
import Data.Newtype
import Data.String as S
import Data.Symbol
import Type.Proxy (Proxy(..))
import Data.Lens
import Data.Lens.Record (prop)
import Data.Lens.Zoom (Traversal, Traversal', Lens, Lens', zoom)
import Partial.Unsafe (unsafePartial)


-- Comparison <
data TreatmentId = StringId String | IntId Int
instance showTreatmentId :: Show TreatmentId where
  show (StringId a) = a
  show (IntId a) = show a

instance equalTreatmentId :: Eq TreatmentId where
  eq (StringId a) (StringId b)  = ((show a) == (show b))
  eq (IntId a) (IntId b) = ((show a) == (show b))
  eq (StringId a) (IntId b) = false
  eq (IntId a) (StringId b) = false

instance orderTreatmentId :: Ord TreatmentId where
  compare (StringId a) (StringId b) = compare a b
  compare (IntId a) (IntId b) = compare a b
  compare (StringId a) (IntId b) = GT
  compare (IntId a) (StringId b) = LT

instance decodeTreatmentIdInstance :: DecodeJson TreatmentId where
  decodeJson tid = 
    let sid = decodeJson tid :: Either JsonDecodeError String
    in case sid of 
         Left _ -> 
           let iidResult = decodeJson tid :: Either JsonDecodeError Int
           in case iidResult of
               Left _ -> pure $ StringId "Error"
               Right iid -> pure $ IntId iid
         Right id -> 
           case Int.fromString id of 
                Just iid -> pure $ IntId iid
                Nothing -> pure $ StringId id

instance encodeTreatmentIdInstance :: EncodeJson TreatmentId where
  encodeJson (StringId s) = encodeJson s
  encodeJson (IntId i) = encodeJson i

decodeTreatmentId :: Json -> Either JsonDecodeError TreatmentId
decodeTreatmentId = decodeJson

treatmentIdToString :: TreatmentId -> String
treatmentIdToString (StringId t) = t
treatmentIdToString (IntId t) = show t

newtype Comparison = Comparison
  { id :: String
  , t1 :: TreatmentId
  , t2 :: TreatmentId
  , numStudies :: Int
  }
derive instance genericComparison :: Rep.Generic Comparison _
instance showComparison :: Show Comparison where
    show = genericShow
instance decodeComparison :: DecodeJson Comparison where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id"
      t1 <- getField obj "t1" >>= decodeTreatmentId
      t2 <- getField obj "t2" >>= decodeTreatmentId
      numStudies <- getField obj "numStudies"
      pure $ Comparison { id
                        , t1
                        , t2
                        , numStudies
                        }

_Comparison :: Lens' Comparison (Record _)
_Comparison = lens (\(Comparison s) -> s) (\_ -> Comparison)

skeletonComparison :: Comparison
skeletonComparison = Comparison { id : "none:none"
                                , t1 : StringId "none"
                                , t2 : StringId "none"
                                , numStudies : 0
                                }

stringToTreatmentId :: String -> TreatmentId
stringToTreatmentId str = do
   let sint = Int.fromString str
   case sint of
     Just sint -> IntId sint
     Nothing -> StringId str
  
stringToComparison :: String -> String -> Comparison
stringToComparison del str = do
  let sid = S.split (S.Pattern del) str
  if (length sid == 2)
     then let st1 = stringToTreatmentId 
                       (unsafePartial $ fromJust $ head sid)
              st2 = stringToTreatmentId 
                       (unsafePartial $ fromJust $ last sid)
            in Comparison { id : str
                       , t1 : min st1 st2                     
                       , t2 : max st1 st2                       
                       , numStudies : 0
                     }
     else Comparison $ (skeletonComparison ^. _Comparison) { id = str }


comparisonsOrdering :: Comparison -> Comparison -> Ordering
comparisonsOrdering compA compB 
  | ((compA ^. _Comparison)."t1") > ((compB ^. _Comparison)."t1" ) = GT
  | ((compA ^. _Comparison)."t1" ) < ((compB ^. _Comparison)."t1") = LT
  | ((compA ^. _Comparison)."t1") == ((compB ^. _Comparison)."t1") = 
    compare ((compA ^. _Comparison)."t2") ((compB ^. _Comparison)."t2")
  | otherwise = EQ

instance equalComparisons :: Eq Comparison where
  eq compA compB = 
     (min ((compA ^. _Comparison)."t1") 
          ((compA ^. _Comparison)."t2" ) ==
      min ((compB ^. _Comparison)."t1") 
          ((compB ^. _Comparison)."t2" ))&&
     (max ((compA ^. _Comparison)."t1") 
          ((compA ^. _Comparison)."t2" ) ==
      max ((compB ^. _Comparison)."t1") 
          ((compB ^. _Comparison)."t2" ))

isIdOfComparison :: String -> Comparison -> Boolean
isIdOfComparison id comp = 
  let t1 = min (comp ^. _Comparison)."t1" (comp ^. _Comparison)."t2"
      t2 = max (comp ^. _Comparison)."t1" (comp ^. _Comparison)."t2"
      sid = S.split (S.Pattern ":") id
      st1 = unsafePartial $ fromJust $ head sid
      st2 = unsafePartial $ fromJust $ last sid
  in (st1 == treatmentIdToString t1) && (st2 == treatmentIdToString t2)  ||
     (st1 == treatmentIdToString t2) && (st2 == treatmentIdToString t1) 

isIdOfComparisonComma :: String -> Comparison -> Boolean
isIdOfComparisonComma id comp = 
  let t1 = min (comp ^. _Comparison)."t1" (comp ^. _Comparison)."t2"
      t2 = max (comp ^. _Comparison)."t1" (comp ^. _Comparison)."t2"
      sid = S.split (S.Pattern ",") id
      st1 = unsafePartial $ fromJust $ head sid
      st2 = unsafePartial $ fromJust $ last sid
  in (st1 == treatmentIdToString t1) && (st2 == treatmentIdToString t2)  ||
     (st1 == treatmentIdToString t2) && (st2 == treatmentIdToString t1) 

hasNode :: Comparison -> Node -> Boolean
hasNode c n = 
  let t1 = (c ^. _Comparison)."t1"
      t2 = (c ^. _Comparison)."t2"
      nid = (n ^. _Node)."id"
  in t1 == nid || t2 == nid
  

isSelectedComparison :: Array String -> Comparison -> Boolean
isSelectedComparison selected comp = do
  let isSelected = foldl (||) false $ map (\sid -> do
                   isIdOfComparison sid comp
                  ) selected
  isSelected

isSelectedNode :: Array String -> Node -> Boolean
isSelectedNode selected node = do
  let isSelected = foldl (||) false $ map (\sid -> do
                   hasNode (stringToComparison ":" sid) node
                  ) selected
  isSelected

sortStringComparisonIds :: Json -> Json
sortStringComparisonIds fsids = 
  let eids = decodeJson fsids :: Either JsonDecodeError (Array String)
      ids = case eids of
           Left _ -> []
           Right idss -> idss
  in encodeJson $ sortBy (\id1 id2 -> 
       comparisonsOrdering (stringToComparison ":" id1)
         (stringToComparison ":" id2)) ids

{--fixComparisonId :: Json  -> Effect Unit --}
fixComparisonId :: Json -> Json
fixComparisonId fsid = 
  let esid = decodeJson fsid :: Either JsonDecodeError String
      sid = case esid of
        Left _ -> "error"
        Right id -> show ((stringToComparison ":" id) ^. _Comparison)."t1" <>
                                                  ":" <>
            show ((stringToComparison ":" id) ^. _Comparison)."t2"
  {--logShow $ "TO SID POU VGANEI EINAI" <>  sid--}
  in encodeJson sid
  
orderIds :: Json -> Json
orderIds ftids = 
  let eids = decodeJson ftids :: Either JsonDecodeError (Array TreatmentId)
      res = case eids of 
             Left _ -> ftids
             Right ids -> encodeJson $ map show (sort ids)
  in res

-- Comparison >

-- InterventionType <
newtype InterventionType = InterventionType
    { id :: String
    , label :: String
    , isSelected :: Boolean
    , isActive :: Boolean
    , isDisabled :: Boolean
    }

derive instance genericInterventionType :: Rep.Generic InterventionType _

instance showInterventionType :: Show InterventionType where
    show = genericShow

instance decodeInterventionType :: DecodeJson InterventionType where
  decodeJson = genericDecodeJson

instance encodeInterventionType :: EncodeJson InterventionType where
  encodeJson (InterventionType it) = encodeJson it

_InterventionType :: Lens' InterventionType (Record _)
_InterventionType = lens (\(InterventionType s) -> s) (\_ -> InterventionType)

defaultInterventionTypes :: Array InterventionType
defaultInterventionTypes = [ InterventionType { id: "notset"
                                              , label: "--"
                                              , isDisabled: true
                                              , isActive: true
                                              , isSelected: false
                                              },
                             InterventionType { id: "Pharmacological"
                                              , label: "Pharmacological"
                                              , isDisabled: false
                                              , isActive: false
                                              , isSelected: false
                                              },
                             InterventionType { id: "Placebo/Control"
                                              , label: "Placebo/Control"
                                              , isDisabled: false
                                              , isActive: false
                                              , isSelected: false
                                              },
                             InterventionType { id: "Non-pharmacological"
                                              , label: "Non-pharmacological"
                                              , isDisabled: false
                                              , isActive: false
                                              , isSelected: false
                                              }
                           ]
-- InterventionType >


-- Node <
newtype Node = Node
    { id :: TreatmentId
    , label :: String
    , numStudies :: Int
    , sampleSize :: Int
    , interventionType :: Array InterventionType
    }

derive instance genericNode :: Rep.Generic Node _

instance showNode :: Show Node where
    show = genericShow

instance equalNodes :: Eq Node where
  eq nA nB = ((nA ^. _Node)."id") == ((nB ^. _Node)."id")

instance orderNodes :: Ord Node where
  compare nA nB = compare ((nA ^. _Node)."id")  ((nB ^. _Node)."id")

instance decodeNode :: DecodeJson Node where
  decodeJson json = case toObject json of
    Nothing -> Left $ TypeMismatch "Object"
    Just obj -> do
      id <- getField obj "id" >>= decodeTreatmentId
      numStudies <- getField obj "numStudies"
      sampleSize <- getField obj "sampleSize"
      let labelResult = getField obj "label" :: Either JsonDecodeError String
      let l = case labelResult of
           Left _ -> 
             let numLabelResult = getField obj "label" :: Either JsonDecodeError Int
             in case numLabelResult of
                  Left _ -> ""
                  Right numLabel -> show numLabel
           Right labelStr -> labelStr
      let itResult = getField obj "interventionType" :: Either JsonDecodeError (Array InterventionType)
      let interventionType = case itResult of
            Left _ -> defaultInterventionTypes
            Right intp -> intp
      pure $ Node { id
                  , label : l
                  , numStudies : Int.floor numStudies
                  , sampleSize : Int.floor sampleSize
                  , interventionType
                  }
instance encodeNode :: EncodeJson Node where
  encodeJson (Node n) = encodeJson
    { id: show n.id
    , label: n.label
    , numStudies: n.numStudies
    , sampleSize: n.sampleSize
    , interventionType: n.interventionType
    }

nodeId :: forall a b r. Lens { "id" :: a | r } { "id" :: b | r } a b
nodeId = prop (Proxy :: Proxy "id")


interventionType :: forall a b r. Lens { interventionType :: a | r } { interventionType :: b | r } a b
interventionType = prop (Proxy :: Proxy "interventionType")

_Node :: Lens' Node (Record _)
_Node = lens (\(Node s) -> s) (\_ -> Node)
-- Node >

