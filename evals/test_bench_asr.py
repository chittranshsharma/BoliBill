import unittest

from bench_asr import edit_distance, normalized_words


class ScoringTests(unittest.TestCase):
    def test_mixed_script_normalization_keeps_hindi_marks(self):
        self.assertEqual(normalized_words("चावल, Two KG!"), ["चावल", "two", "kg"])

    def test_edit_distance_counts_substitute_insert_delete(self):
        self.assertEqual(edit_distance(["do", "kilo"], ["do", "packet"]), 1)
        self.assertEqual(edit_distance(["do", "kilo"], ["do"]), 1)
        self.assertEqual(edit_distance("चावल", "चावला"), 1)


if __name__ == "__main__":
    unittest.main()
