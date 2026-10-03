import unittest
from free_game_counters import advance_free_game_counters as advance
from round_fields import FieldError
class FreeCounterTests(unittest.TestCase):
 def test_additions_enabled_without_award_selector(self):
  old={'total':10,'remaining':4,'played':6};new={'total':15,'remaining':8,'played':7}
  self.assertEqual(advance(old,new),{'added':5,'remaining':8})
  self.assertEqual(advance(old,new,added=5),{'added':5,'remaining':8})
 def test_multiple_awards_then_completion(self):
  prior={'total':6,'remaining':6,'played':0}
  for award in (0,3,0,2,0,0,0,0,0,0,0):
   current={'total':prior['total']+award,'remaining':prior['remaining']-1+award,'played':prior['played']+1}
   self.assertEqual(advance(prior,current)['added'],award);prior=current
  self.assertEqual(prior['remaining'],0)
  with self.assertRaises(FieldError):advance(prior,{'total':12,'remaining':0,'played':12})
 def test_bad_reports_counters_and_progress_rejected(self):
  old={'total':10,'remaining':4,'played':6};new={'total':15,'remaining':8,'played':7}
  for extra in ({'added':4},{'consumed':2},{'maximum':12}):
   with self.assertRaises(FieldError):advance(old,new,**extra)
  for bad in ({**new,'played':6},{**new,'remaining':7},{**new,'total':-1},{**new,'remaining':True}):
   with self.assertRaises(FieldError):advance(old,bad)
 def test_intro_without_consumption_is_explicit(self):
  old={'total':6,'remaining':6,'played':0};new={'total':9,'remaining':9,'played':0}
  self.assertEqual(advance(old,new,consumed=0)['added'],3)
  with self.assertRaises(FieldError):advance(old,new)
  with self.assertRaises(FieldError):advance(None,old,added=False)
if __name__=='__main__':unittest.main()
