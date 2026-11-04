import unittest
from datetime import timedelta

from data_pipeline.core import instant, number
from data_pipeline.sources import parse_entsoe, parse_charts, parse_gie, gas_day

A = instant('2025-11-04')
B = A+timedelta(hours=1)


def xml(points,curve='A01',extra='',document='A44'):
    return f'''<Publication_MarketDocument xmlns="urn:test"><createdDateTime>2026-11-04T00:00Z</createdDateTime>
      <TimeSeries><curveType>{curve}</curveType>{extra}<Period><timeInterval>
      <start>2025-11-04T00:00Z</start><end>2025-11-04T01:00Z</end></timeInterval>
      <resolution>PT15M</resolution>{points}</Period></TimeSeries></Publication_MarketDocument>'''.encode()


class Parsers(unittest.TestCase):
    def test_a03_holds_until_next_position_and_keeps_negative_prices(self):
        rows=parse_entsoe(xml('<Point><position>1</position><price.amount>-4.2</price.amount></Point><Point><position>4</position><price.amount>0</price.amount></Point>','A03',
            '<currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name>'),'day_ahead_price',A,B)
        self.assertEqual([r.value for r in rows],[-4.2,-4.2,-4.2,0])
        self.assertTrue(all(r.unit=='EUR/MWh' for r in rows))
        self.assertTrue(all(r.end-r.start==timedelta(minutes=15) for r in rows))
        self.assertIsNone(rows[0].published_at)  # response generation time is not an issue time

    def test_a01_does_not_fill_missing_positions(self):
        rows=parse_entsoe(xml('<Point><position>1</position><quantity>0</quantity></Point><Point><position>4</position><quantity>40</quantity></Point>'), 'load',A,B)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0].value,0)
        self.assertEqual(rows[1].start,A+timedelta(minutes=45))

    def test_generation_consumption_remains_distinct(self):
        payload=xml('<Point><position>1</position><quantity>30</quantity></Point>',extra='<outBiddingZone_Domain.mRID>BG</outBiddingZone_Domain.mRID><MktPSRType><psrType>B10</psrType></MktPSRType><quantity_Measure_Unit.name>MAW</quantity_Measure_Unit.name>')
        r=parse_entsoe(payload,'generation',A,B)[0]
        self.assertEqual(r.dimensions['measurement'],'consumption')
        self.assertEqual(r.unit,'MW')

    def test_charts_flows_convert_gw_to_mw_and_keep_unknown(self):
        d={'unix_seconds':[int(A.timestamp())+i*900 for i in range(3)],'countries':[{'name':'Greece','data':[-1.2,None,0]}]}
        rows=parse_charts(d,'physical_flow',A,B)
        self.assertEqual(rows[0].value,-1200)
        self.assertEqual(rows[0].unit,'MW')
        self.assertIsNone(rows[1].value)
        self.assertEqual(rows[1].quality,'missing')

    def test_gas_days_handle_dst_and_gie_status_does_not_change_identity(self):
        self.assertEqual((gas_day('2026-03-30')-gas_day('2026-03-29')).total_seconds(),86400)
        self.assertEqual((gas_day('2026-03-29')-gas_day('2026-03-28')).total_seconds(),23*3600)
        self.assertEqual((gas_day('2026-10-25')-gas_day('2026-10-24')).total_seconds(),25*3600)
        d={'data':[{'code':'BG','gasDayStart':'2025-11-04','gasDayEnd':'2025-11-05','gasInStorage':'5.8787','injection':'0','full':'-','status':'E'}]}
        rows=parse_gie(d,'gie-agsi','BG',A,A+timedelta(days=2))
        self.assertEqual(rows[0].start.hour,5)
        self.assertEqual(rows[0].unit,'TWh')
        self.assertEqual(rows[1].value,None)  # full comes before injection in field iteration
        self.assertEqual(rows[2].value,0)
        self.assertTrue(all(not r.dimensions for r in rows))

    def test_invalid_numeric_values_are_missing_not_zero(self):
        for value in [None,'-','NaN','inf',float('inf'),True]:
            self.assertIsNone(number(value))
        self.assertEqual(number('0'),0)


if __name__=='__main__':
    unittest.main()
