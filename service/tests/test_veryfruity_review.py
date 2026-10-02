import copy
import unittest

from veryfruity_review import review_free_prefix
from round_fields import FieldError


def sample():
    return [{'requestSession': 'fixture', 'responseSession': 'fixture',
             'FSInfo': {'freeSpinNumber': str(i), 'freeSpinsTotal': '6',
                        'fsWinnings': str(i * 25), 'originalScatterWin': '50'}} for i in range(7)]


class VeryFruityReviewTests(unittest.TestCase):
    def test_prefixes_keep_endgame_distinct_from_complete(self):
        for count in range(1, 8):
            result = review_free_prefix(sample()[:count])
            self.assertEqual(result['nextRequestHypothesis'], 'EndGame' if count == 7 else 'Logic')
            self.assertFalse(result['complete'])
            self.assertFalse(result['captureAuthorization'])

    def test_missing_and_permissive_display_values_rejected(self):
        for value in ('', '-1', '1.5', '1suffix', 'NaN', '01', '9007199254740992', 1, True):
            raw = sample()
            raw[1]['FSInfo']['freeSpinNumber'] = value
            with self.subTest(value=value), self.assertRaises(FieldError):
                review_free_prefix(raw)
        raw = sample()
        del raw[0]['FSInfo']['fsWinnings']
        with self.assertRaises(FieldError):
            review_free_prefix(raw)

    def test_unreviewed_routes_and_sessions_rejected(self):
        mutations = [lambda r: r[1]['FSInfo'].update(freeSpinsTotal='12'),
                     lambda r: r[1]['FSInfo'].update(isMaxWin='true'),
                     lambda r: r[1]['FSInfo'].update(freeSpinNumber='2'),
                     lambda r: r[-1]['FSInfo'].update(freeSpinNumber='7'),
                     lambda r: r[1].update(responseSession='rotated'),
                     lambda r: r[1].update(requestSession='wrong'),
                     lambda r: r[2]['FSInfo'].update(fsWinnings='0')]
        for mutate in mutations:
            raw = copy.deepcopy(sample())
            mutate(raw)
            with self.assertRaises(FieldError):
                review_free_prefix(raw)

    def test_no_second_response_after_counter_terminal(self):
        raw = sample()
        raw.append(copy.deepcopy(raw[-1]))
        with self.assertRaises(FieldError):
            review_free_prefix(raw)

    def test_response_session_is_used_by_the_next_request(self):
        raw = sample()
        for i, frame in enumerate(raw):
            frame['requestSession'] = 'fixture-' + str(i)
            frame['responseSession'] = 'fixture-' + str(i + 1)
        self.assertEqual(review_free_prefix(raw)['nextRequestHypothesis'], 'EndGame')
        raw[3]['requestSession'] = 'fixture-old'
        with self.assertRaisesRegex(FieldError, 'VERYFRUITY_REVIEW_SESSION'):
            review_free_prefix(raw)


if __name__ == '__main__':
    unittest.main()
