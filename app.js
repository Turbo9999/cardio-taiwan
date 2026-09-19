1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
97
98
99
100
101
102
103
104
105
106
107
108
109
110
111
112
113
114
115
116
117
118
119
120
121
122
123
124
125
126
127
128
129
130
131
132
133
134
135
136
137
138
139
140
141
142
143
144
145
146
147
148
149
150
151
152
153
154
155
156
157
158
159
160
161
162
163
164
165
166
167
168
169
170
171
172
173
174
175
176
177
178
179
180
181
182
183
184
185
186
187
188
189
190
191
192
193
194
195
196
197
198
199
200
201
202
203
204
205
206
207
208
209
210
211
212
213
214
215
216
217
218
219
220
221
222
223
224
225
226
227
228
229
230
231
232
233
234
235
236
237
238
239
240
241
242
243
244
245
246
247
248
249
250
251
252
253
254
255
256
257
258
259
260
261
262
263
264
265
266
267
268
269
270
271
272
273
274
275
276
277
278
279
280
281
282
283
284
285
286
287
288
289
290
291
292
293
294
295
296
297
298
299
300
301
302
303
304
305
306
307
308
309
310
311
312
313
314
315
316
317
318
319
320
321
322
323
324
325
326
327
328
329
330
331
332
333
334
335
336
337
338
339
340
341
342
343
344
345
346
347
348
349
350
351
352
353
354
355
356
357
358
359
360
361
362
363
364
365
366
367
368
369
370
371
372
373
374
375
376
377
378
379
380
381
382
383
384
385
386
387
388
389
390
391
392
393
394
395
396
397
398
399
400
401
402
403
404
405
406
407
408
409
410
411
412
413
414
415
416
417
418
419
420
421
422
423
424
425
426
427
428
429
430
431
432
433
434
435
436
437
438
439
440
441
442
443
444
445
446
447
448
449
450
451
452
453
454
455
456
457
458
459
460
461
462
463
464
465
466
467
468
469
470
471
472
473
474
475
476
477
478
479
480
481
482
483
484
485
486
487
488
489
490
491
492
493
494
495
496
497
498
499
500
501
502
503
504
505
506
507
508
509
510
511
512
513
514
515
516
517
518
519
520
521
522
523
524
525
526
527
528
529
530
531
532
533
534
535
536
537
538
539
540
541
542
543
544
545
546
547
548
549
550
551
552
553
554
555
556
557
558
559
560
561
562
563
564
565
566
567
568
569
570
571
572
573
574
575
576
577
578
579
580
581
582
583
584
585
586
587
588
589
590
591
592
593
594
595
596
597
598
599
600
601
602
603
604
605
606
607
608
609
610
611
612
613
614
615
616
617
618
619
620
621
622
623
624
625
626
627
628
629
630
631
632
633
634
635
636
637
638
639
640
641
642
643
644
645
646
647
648
649
650
651
652
653
654
655
656
657
658
659
660
661
662
663
664
665
666
667
668
669
670
671
672
673
674
675
676
677
678
679
680
681
682
683
684
685
686
687
688
689
690
691
692
693
694
695
696
697
698
699
700
701
702
703
704
705
706
707
708
709
710
711
712
713
714
715
716
717
718
719
720
721
722
723
724
725
726
727
728
729
730
731
732
733
734
735
736
737
738
739
740
741
742
743
744
745
746
747
748
749
750
751
752
753
754
755
756
757
758
759
760
761
762
763
764
765
766
767
768
769
770
771
772
773
774
775
776
777
778
779
780
781
782
783
784
785
786
787
788
789
790
791
792
793
794
795
796
797
798
799
800
801
802
803
804
805
806
807
808
809
810
811
812
813
814
815
816
817
818
819
820
821
822
823
824
825
826
827
828
829
830
831
832
833
834
835
836
837
838
839
840
841
842
843
844
845
846
847
848
849
850
851
852
853
854
855
856
857
858
859
860
861
862
863
864
865
866
867
868
869
870
871
872
873
874
875
876
877
878
879
880
881
882
883
884
885
886
887
888
889
890
891
892
893
894
895
896
897
898
899
900
901
902
903
904
905
906
907
908
909
910
911
912
913
914
915
916
917
918
919
920
921
922
923
924
925
926
927
928
929
930
931
932
933
934
935
936
937
938
939
940
941
942
943
944
945
946
947
948
949
950
951
952
953
954
955
956
957
958
959
960
961
962
963
964
965
966
967
968
969
970
971
972
973
974
975
976
977
978
979
980
981
982
983
984
985
986
987
988
989
990
991
992
993
994
995
996
997
998
999
1000
1001
1002
1003
1004
1005
1006
1007
1008
1009
1010
1011
1012
1013
1014
1015
1016
1017
1018
1019
1020
1021
1022
1023
1024
1025
1026
1027
1028
1029
1030
1031
1032
1033
1034
1035
1036
1037
1038
1039
1040
1041
1042
1043
1044
1045
1046
1047
1048
1049
1050
1051
1052
1053
1054
1055
1056
1057
1058
1059
1060
1061
1062
1063
1064
1065
1066
1067
1068
1069
1070
1071
1072
1073
1074
1075
1076
1077
1078
1079
1080
1081
1082
1083
1084
1085
1086
1087
1088
1089
1090
1091
1092
1093
1094
1095
1096
1097
1098
1099
1100
1101
1102
1103
1104
1105
1106
1107
1108
1109
1110
1111
1112
1113
1114
1115
1116
1117
1118
1119
1120
1121
1122
1123
1124
1125
1126
1127
1128
1129
1130
1131
1132
1133
1134
1135
1136
1137
1138
1139
1140
1141
1142
1143
1144
1145
1146
1147
1148
1149
1150
1151
1152
1153
1154
1155
1156
1157
1158
1159
1160
1161
1162
1163
1164
1165
1166
1167
1168
1169
1170
1171
1172
1173
1174
1175
1176
1177
1178
1179
1180
1181
1182
1183
1184
1185
1186
1187
1188
1189
1190
1191
1192
1193
1194
1195
1196
1197
1198
1199
1200
1201
1202
1203
1204
1205
1206
1207
1208
1209
1210
1211
1212
1213
1214
1215
1216
1217
1218
1219
1220
1221
1222
1223
1224
1225
1226
1227
1228
1229
1230
1231
1232
1233
1234
1235
1236
1237
1238
1239
1240
1241
1242
1243
1244
1245
1246
1247
1248
1249
1250
1251
1252
1253
1254
1255
1256
1257
1258
1259
1260
1261
1262
1263
1264
1265
1266
1267
1268
1269
1270
1271
1272
1273
1274
1275
1276
1277
1278
1279
1280
1281
1282
1283
1284
1285
1286
1287
1288
1289
1290
1291
1292
1293
1294
1295
1296
1297
1298
1299
1300
1301
1302
1303
1304
1305
1306
1307
1308
1309
1310
1311
1312
1313
1314
1315
1316
1317
1318
1319
1320
1321
1322
1323
1324
1325
1326
1327
1328
1329
1330
1331
1332
1333
1334
1335
1336
1337
1338
1339
1340
1341
1342
1343
1344
1345
1346
1347
1348
1349
1350
1351
1352
1353
1354
1355
1356
1357
1358
1359
1360
1361
1362
1363
1364
1365
1366
1367
1368
1369
1370
1371
1372
1373
1374
1375
1376
1377
1378
1379
1380
1381
1382
1383
1384
1385
1386
1387
1388
1389
1390
1391
1392
1393
1394
1395
1396
1397
1398
1399
1400
1401
1402
1403
1404
1405
1406
1407
1408
1409
1410
1411
1412
1413
1414
1415
1416
1417
1418
1419
1420
1421
1422
1423
1424
1425
1426
1427
1428
1429
1430
1431
1432
1433
1434
1435
1436
1437
1438
1439
1440
1441
1442
1443
1444
1445
1446
1447
1448
1449
1450
1451
1452
1453
1454
1455
1456
1457
1458
1459
1460
1461
1462
1463
1464
1465
1466
1467
1468
1469
1470
1471
1472
1473
1474
1475
1476
1477
1478
1479
1480
1481
1482
1483
1484
1485
1486
1487
1488
1489
1490
1491
1492
1493
1494
1495
1496
1497
1498
1499
1500
1501
1502
1503
1504
1505
1506
1507
1508
1509
1510
1511
1512
1513
1514
1515
1516
1517
1518
1519
1520
1521
1522
1523
1524
1525
1526
1527
1528
1529
1530
1531
1532
1533
1534
1535
1536
1537
1538
1539
1540
1541
1542
1543
1544
1545
1546
1547
1548
1549
1550
1551
1552
1553
1554
1555
1556
1557
1558
1559
1560
1561
1562
1563
1564
1565
1566
1567
1568
1569
1570
1571
1572
1573
1574
1575
1576
1577
1578
1579
1580
1581
1582
1583
1584
1585
1586
1587
1588
1589
1590
1591
1592
1593
1594
1595
1596
1597
1598
1599
1600
1601
1602
1603
1604
1605
1606
1607
1608
1609
1610
1611
1612
1613
1614
1615
1616
1617
1618
1619
1620
1621
1622
1623
1624
1625
1626
1627
1628
1629
1630
1631
1632
1633
1634
1635
1636
1637
1638
1639
1640
1641
1642
1643
1644
1645
1646
1647
1648
1649
1650
1651
1652
1653
1654
1655
1656
1657
1658
1659
1660
1661
1662
1663
1664
1665
1666
1667
1668
1669
1670
1671
1672
1673
1674
1675
1676
1677
1678
1679
1680
1681
1682
1683
1684
1685
1686
1687
1688
1689
1690
1691
1692
1693
1694
1695
1696
1697
1698
1699
1700
1701
1702
1703
1704
1705
1706
1707
1708
1709
1710
1711
1712
1713
1714
1715
1716
1717
1718
1719
1720
1721
1722
1723
1724
1725
1726
1727
1728
1729
1730
1731
1732
1733
1734
1735
1736
1737
1738
1739
1740
1741
1742
1743
1744
1745
1746
1747
1748
1749
1750
1751
1752
1753
1754
1755
1756
1757
1758
1759
1760
1761
1762
1763
1764
1765
1766
1767
1768
1769
1770
1771
1772
1773
1774
1775
1776
1777
1778
1779
1780
1781
1782
1783
1784
1785
1786
1787
1788
1789
1790
1791
1792
1793
1794
1795
1796
1797
1798
1799
1800
1801
1802
1803
1804
1805
1806
1807
1808
1809
1810
1811
1812
1813
1814
1815
1816
1817
1818
1819
1820
1821
1822
1823
1824
1825
1826
1827
1828
1829
1830
1831
1832
1833
1834
1835
1836
1837
1838
1839
1840
1841
1842
1843
1844
1845
1846
1847
1848
1849
1850
1851
1852
1853
1854
1855
1856
1857
1858
1859
1860
1861
1862
1863
1864
1865
1866
1867
1868
1869
1870
1871
1872
1873
1874
1875
1876
1877
1878
1879
1880
1881
1882
1883
1884
1885
1886
1887
1888
1889
1890
1891
1892
1893
1894
1895
1896
1897
1898
1899
1900
1901
1902
1903
1904
1905
1906
1907
1908
1909
1910
1911
1912
1913
1914
1915
1916
1917
1918
1919
1920
1921
1922
1923
1924
1925
1926
1927
1928
1929
1930
1931
1932
1933
1934
1935
1936
1937
1938
1939
1940
1941
1942
1943
1944
1945
1946
1947
1948
1949
1950
1951
1952
1953
1954
1955
1956
1957
1958
1959
1960
1961
1962
1963
1964
1965
1966
1967
1968
1969
1970
1971
1972
1973
1974
1975
1976
1977
1978
1979
1980
1981
1982
1983
1984
1985
1986
1987
1988
1989
1990
1991
1992
1993
1994
1995
1996
1997
1998
1999
2000
2001
2002
2003
2004
2005
2006
2007
2008
2009
2010
2011
2012
2013
2014
2015
2016
2017
2018
2019
2020
2021
2022
2023
2024
2025
2026
2027
2028
2029
2030
2031
2032
2033
2034
2035
2036
2037
2038
2039
2040
2041
2042
2043
2044
2045
2046
2047
2048
2049
2050
2051
2052
2053
2054
2055
2056
2057
2058
2059
2060
2061
2062
2063
2064
2065
2066
2067
2068
2069
2070
2071
2072
2073
2074
2075
2076
2077
2078
2079
2080
2081
2082
2083
2084
2085
2086
2087
2088
2089
2090
2091
2092
2093
2094
2095
2096
2097
2098
2099
2100
2101
2102
2103
2104
2105
2106
2107
2108
2109
2110
2111
2112
2113
2114
2115
2116
2117
2118
2119
2120
2121
2122
2123
2124
2125
2126
2127
2128
2129
2130
2131
2132
2133
2134
2135
2136
2137
2138
2139
2140
2141
2142
2143
2144
2145
2146
2147
2148
2149
2150
2151
2152
2153
2154
2155
2156
2157
2158
2159
2160
2161
2162
2163
2164
2165
2166
2167
2168
2169
2170
2171
2172
2173
2174
2175
2176
2177
2178
2179
2180
2181
2182
2183
2184
2185
2186
2187
2188
2189
2190
2191
2192
2193
2194
2195
2196
2197
2198
2199
2200
2201
2202
2203
2204
2205
2206
2207
2208
2209
2210
2211
2212
2213
2214
2215
2216
2217
2218
2219
2220
2221
2222
2223
2224
2225
2226
2227
2228
2229
2230
2231
2232
2233
2234
2235
2236
2237
2238
2239
2240
2241
2242
2243
2244
2245
2246
2247
2248
2249
2250
2251
2252
2253
2254
2255
2256
2257
2258
2259
2260
2261
2262
2263
2264
2265
2266
2267
2268
2269
2270
2271
2272
2273
2274
2275
2276
2277
2278
2279
2280
2281
2282
2283
2284
2285
2286
2287
2288
2289
2290
2291
2292
2293
2294
2295
2296
2297
2298
2299
2300
2301
2302
2303
2304
2305
2306
2307
2308
2309
2310
2311
2312
2313
2314
2315
2316
2317
2318
2319
2320
2321
2322
2323
2324
2325
2326
2327
2328
2329
2330
2331
2332
2333
2334
2335
2336
2337
2338
2339
2340
2341
2342
2343
2344
2345
2346
2347
2348
2349
2350
2351
2352
2353
2354
2355
2356
2357
2358
2359
2360
2361
2362
2363
2364
2365
2366
2367
2368
2369
2370
2371
2372
2373
2374
2375
2376
2377
2378
2379
2380
2381
2382
2383
2384
2385
2386
2387
2388
2389
2390
2391
2392
2393
2394
2395
2396
2397
2398
2399
2400
2401
2402
2403
2404
2405
2406
2407
2408
2409
2410
2411
2412
2413
2414
2415
2416
2417
2418
2419
2420
2421
2422
2423
2424
2425
2426
2427
2428
2429
2430
2431
2432
2433
2434
2435
2436
2437
2438
2439
2440
2441
2442
2443
2444
2445
2446
2447
2448
2449
2450
2451
2452
2453
2454
2455
2456
2457
2458
2459
2460
2461
2462
2463
2464
2465
2466
2467
2468
2469
2470
2471
2472
2473
2474
2475
2476
2477
2478
2479
2480
2481
2482
2483
2484
2485
2486
2487
2488
2489
2490
2491
2492
2493
2494
2495
2496
2497
2498
2499
2500
2501
2502
2503
2504
2505
2506
2507
2508
2509
2510
2511
2512
2513
2514
2515
2516
2517
2518
2519
2520
2521
2522
2523
2524
2525
2526
2527
2528
2529
2530
2531
2532
2533
2534
2535
2536
2537
2538
2539
2540
2541
2542
2543
2544
2545
2546
2547
2548
2549
2550
2551
2552
2553
2554
2555
2556
2557
2558
2559
2560
2561
2562
2563
2564
2565
2566
2567
2568
2569
2570
2571
2572
2573
2574
2575
2576
2577
2578
2579
const SUPABASE_URL = "https://wylfqwzictkepnefwksx.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5ITurxoUWu2ihIkDBrzWaQ_8uFP1LxZ";


const AUTH_STORAGE_KEY = "cq_auth_session";
let authSession = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
let currentUser = null;
let profileName = "";
let isAdmin = false;
let themeColor = localStorage.getItem("cq_theme_color") || "black";
let socialCity = "";
let socialBranchId = "";




// ========================================
// CARDIO TAIWAN
// ========================================


let branches = [];
let schedule = [];
let worldGymBranchSlugs = new Map();
let worldGymBranchLocations = new Map();
let savedTasks = JSON.parse(localStorage.getItem("cq_saved_tasks") || "[]");




function normalizedBranchName(name){


  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/World\s*Gym/gi, "")
    .trim();


}




function worldGymBranchSlug(officialUrl, branchName = ""){


  // Supabase currently has both「台北統領」and「台北統領店」,
  // but only the first record carries the official URL. They are the same club.
  if(
    branchName === "台北統領" ||
    branchName === "台北統領店"
  ){
    return "taipei-tonling";
  }


  const listedSlug =
    worldGymBranchSlugs.get(
      normalizedBranchName(branchName)
    );


  if(listedSlug){
    return listedSlug;
  }


  if(!officialUrl){
    return "";
  }


  try{


    const match =
      new URL(officialUrl).pathname.match(
        /^\/en\/find-a-club\/([a-z0-9-]+)\/aerobics-class-schedule\/?$/i
      );


    return match ? match[1].toLowerCase() : "";


  }catch(error){


    return "";


  }


}




// ========================================
// 使用者目前選擇
// 不預設任何分店
// ========================================


let selectedBranchId =
  localStorage.getItem("cq_branch_id") || "";


let selectedBranchName =
  localStorage.getItem("cq_branch_name") || "";


let selectedCity =
  localStorage.getItem("cq_city") || "";


let selectedDate =
  localStorage.getItem("cq_date") || "";




const badges = [
  ["🥊","Combat Rookie","完成 1 堂 BODYCOMBAT®",true],
  ["🥊","Combat Warrior","完成 25 堂 BODYCOMBAT®",false],
  ["🏋️","Pump Starter","完成 5 堂 BODYPUMP®",false],
  ["🔥","Cardio Beast","累積 50 小時有氧",false],
  ["⚡","Early Bird","完成 10 堂早晨課程",false],
  ["🌈","Class Collector","完成 5 種不同課程",false]
];




let xp =
  Number(localStorage.getItem("cq_xp") || 0);


let completed =
  Number(localStorage.getItem("cq_completed") || 0);


let streak =
  Number(localStorage.getItem("cq_streak") || 0);




const content =
  document.querySelector("#content");


const title =
  document.querySelector("#pageTitle");




// ========================================
// UI 工具
// ========================================


function toast(msg){


  const el =
    document.querySelector("#toast");


  if(!el) return;


  el.textContent = msg;


  el.classList.add("show");


  setTimeout(() => {


    el.classList.remove("show");


  }, 1800);


}




function formatDate(date){


  if(!date) return "";


  const parts =
    date.split("-");


  if(parts.length !== 3){
    return date;
  }


  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;


}




function formatDateSlash(date){


  if(!date) return "";


  return date.replaceAll("-", "/");


}




// ========================================
// 課表頁 CSS
// ========================================


function injectScheduleStyles(){


  if(
    document.querySelector(
      "#schedule-page-styles"
    )
  ){
    return;
  }


  const style =
    document.createElement("style");


  style.id =
    "schedule-page-styles";


  style.textContent = `

    .schedule-controls{
      display:flex;
      flex-direction:column;
      gap:12px;
      margin:24px 0 24px;
    }

    .schedule-control{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .schedule-control-label{
      width:72px;
      min-width:72px;
      font-size:17px;
      font-weight:700;
      color:#f3f4f6;
      line-height:1;
    }

    .schedule-control-input{
      flex:1;
      min-width:0;
      height:52px;
      box-sizing:border-box;
      border:1px solid #293242;
      border-radius:16px;
      background:#121720;
      color:#f5f7fb;
      padding:0 14px;
      font-size:16px;
      outline:none;
    }

    .schedule-control-input:focus{
      border-color:#e94f9b;
      box-shadow:
        0 0 0 2px
        rgba(233,79,155,.12);
    }

    .schedule-control-input:disabled{
      opacity:.5;
      cursor:not-allowed;
    }

    .schedule-date-input{
      color-scheme:dark;
    }

    .schedule-empty{
      padding:32px 18px;
      text-align:center;
      border:1px dashed #303847;
      border-radius:18px;
      color:#9ca3af;
      background:#11161e;
    }

    .schedule-loading{
      padding:30px 18px;
      text-align:center;
      color:#a8afbd;
    }

    .schedule-heading{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }

    .schedule-heading h3{
      margin:0;
    }

    .schedule-heading-date{
      color:#929aaa;
      font-size:14px;
      white-space:nowrap;
    }

    .schedule-notice{
      padding:18px;
      border-radius:16px;
      background:#11161e;
      border:1px solid #293242;
      color:#aeb5c2;
      text-align:center;
    }

    /* ==================================
       分店下拉選單
       ================================== */

    #branchSelector{
      appearance:auto;
      -webkit-appearance:auto;
    }

    #branchSelector optgroup{
      font-weight:700;
    }

    #branchSelector option{
      font-weight:400;
    }

    @media(max-width:430px){

      .schedule-control-label{
        width:68px;
        min-width:68px;
        font-size:16px;
      }

      .schedule-control-input{
        height:50px;
        font-size:15px;
      }

    }

  `;


  document.head.appendChild(style);


}




// ========================================
// Supabase API
// ========================================


function authHeaders(){
  return {
    "apikey": SUPABASE_PUBLISHABLE_KEY,
    "Authorization": `Bearer ${authSession?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}


async function authRequest(path, options = {}){
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(payload.message || payload.error_description || payload.msg || payload.error || "帳號服務暫時無法使用");
  return payload;
}


async function saveCloudProfile(){
  if(!currentUser || !authSession) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Prefer": "return=minimal" },
    body: JSON.stringify({ display_name: profileName || currentUser.email.split("@")[0], theme_color: themeColor, xp, streak_days: streak })
  });
  if(!response.ok) throw new Error("個人資料同步失敗");
}


async function loadCloudProfile(){
  if(!currentUser || !authSession) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}&select=display_name,theme_color,xp,streak_days,is_admin`, { headers: authHeaders() });
  if(!response.ok) return;
  const rows = await response.json();
  if(rows[0]){
    profileName = rows[0].display_name || "";
    themeColor = rows[0].theme_color || themeColor;
    xp = Number(rows[0].xp || 0);
    streak = Number(rows[0].streak_days || 0);
    isAdmin = rows[0].is_admin === true;
    applyTheme(themeColor, false);
  }
  const workoutResponse = await fetch(`${SUPABASE_URL}/rest/v1/workouts?user_id=eq.${currentUser.id}&select=id`, { headers: authHeaders() });
  if(workoutResponse.ok) completed = (await workoutResponse.json()).length;
}


async function restoreSession(){
  if(!authSession?.access_token) return;
  try{
    currentUser = await authRequest("user", { headers: { "Authorization": `Bearer ${authSession.access_token}` } });
    profileName = currentUser.user_metadata?.display_name || "";
    await loadCloudProfile();
  }catch(error){
    authSession = null;
    currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}


function consumeAuthCallback(){
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if(!accessToken) return;
  authSession = { access_token: accessToken, refresh_token: refreshToken || "" };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
  window.history.replaceState({}, document.title, window.location.pathname);
}


function signInWithGoogle(){
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.assign(`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`);
}


function applyTheme(color, persist = true){
  const palette = {
    "#ff4f86":"#8b7cff", "#7c5cff":"#38bdf8", "#0ea5a4":"#39d98a",
    "#f59e0b":"#f97316", "#ef4444":"#ec4899"
  };
  themeColor = palette[color] ? color : "#ff4f86";
  document.documentElement.style.setProperty("--accent", themeColor);
  document.documentElement.style.setProperty("--accent2", palette[themeColor]);
  if(persist) localStorage.setItem("cq_theme_color", themeColor);
}


function syncAvatar(){
  const avatar = document.querySelector("#avatar");
  if(!avatar) return;
  const label = (profileName || currentUser?.email || "T").trim();
  avatar.textContent = (label.slice(0, 1) || "T").toUpperCase();
}


async function updateProfile(event){
  event.preventDefault();
  const form = event.currentTarget;
  const displayName = form.display_name.value.trim().slice(0, 40);
  const color = form.theme_color.value;
  if(!displayName) return toast("請填寫暱稱");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try{
    profileName = displayName;
    applyTheme(color);
    await saveCloudProfile();
    syncAvatar();
    toast("個人資料已儲存");
    render("profile");
  }catch(error){ toast(`⚠️ ${error.message}`); }
  finally{ button.disabled = false; }
}


function escapeHtml(value){
  return String(value || "").replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[character]));
}


function recordSearch(kind, label){
  if(!label) return;
  fetch(`${SUPABASE_URL}/rest/v1/search_events`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ kind, label }) }).catch(() => {});
}


async function signOut(){
  try{ if(authSession) await authRequest("logout", { method:"POST", headers:{ "Authorization": `Bearer ${authSession.access_token}` } }); }catch(error){}
  authSession = null; currentUser = null; profileName = ""; isAdmin = false;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  toast("已登出");
  render("profile");
}


async function supabaseFetch(
  table,
  params
){


  const url =
    `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;


  const response =
    await fetch(
      url,
      {
        method:"GET",


        headers:{
          "apikey":
            SUPABASE_PUBLISHABLE_KEY,


          "Authorization":
            `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,


          "Accept":
            "application/json"
        }
      }
    );




  if(!response.ok){


    const errorText =
      await response.text();


    throw new Error(errorText);


  }




  return response.json();


}




// ========================================
// 載入分店
// ========================================


async function loadBranches(){


  const params =
    new URLSearchParams({


      select:
        "id,name,city,official_url",


      order:
        "city.asc,name.asc"


    });




  branches =
    await supabaseFetch(
      "branches",
      params
    );




  if(!branches.length){


    throw new Error(
      "Supabase branches 沒有資料"
    );


  }




  // 如果之前有選過分店
  // 而且這間分店仍然存在
  // 就保留使用者的選擇


  if(selectedBranchId){


    const savedBranch =
      branches.find(
        branch =>
          branch.id === selectedBranchId
      );




    if(savedBranch){


      selectedBranchName =
        savedBranch.name;


      selectedCity =
        savedBranch.city || "";


      localStorage.setItem(
        "cq_city",
        selectedCity
      );


    }else{


      selectedBranchId = "";
      selectedBranchName = "";


      localStorage.removeItem(
        "cq_branch_id"
      );


      localStorage.removeItem(
        "cq_branch_name"
      );


    }


  }




  if(
    selectedCity &&
    !branches.some(
      branch =>
        branch.city === selectedCity
    )
  ){


    selectedCity = "";


    localStorage.removeItem(
      "cq_city"
    );


  }


}




// World Gym's public Find a Club response supplies the authoritative mapping
// from each Taiwanese branch name to its public schedule-page slug.
async function loadWorldGymBranchSlugs(){


  try{


    const response =
      await fetch("/api/worldgym-branches");


    const payload =
      await response.json();


    if(!response.ok || !payload.success){
      throw new Error(payload.error || "World Gym 分店清單載入失敗");
    }


    worldGymBranchSlugs =
      new Map(
        payload.branches.map(
          branch => [
            normalizedBranchName(branch.name),
            branch.slug
          ]
        )
      );


    worldGymBranchLocations = new Map(
      payload.branches.map(branch => [normalizedBranchName(branch.name), { latitude: branch.latitude, longitude: branch.longitude }])
    );


    const expressBranchNames =
      new Set(
        payload.branches
          .filter(
            branch =>
              branch.series === "Express"
          )
          .map(
            branch =>
              normalizedBranchName(branch.name)
          )
      );


    // Express stores are intentionally excluded from CARDIO TAIWAN's
    // branch selector, using World Gym's own public series classification.
    branches =
      branches.filter(
        branch =>
          !expressBranchNames.has(
            normalizedBranchName(branch.name)
          )
      );


    if(
      selectedBranchId &&
      !branches.some(
        branch =>
          branch.id === selectedBranchId
      )
    ){


      selectedBranchId = "";
      selectedBranchName = "";
      schedule = [];


      localStorage.removeItem(
        "cq_branch_id"
      );


      localStorage.removeItem(
        "cq_branch_name"
      );


    }


  }catch(error){


    // Keep the existing Supabase schedule path usable if the public list
    // is temporarily unavailable.
    console.warn(
      "World Gym branch list error:",
      error
    );


  }


}




// ========================================
// 載入指定分店＋指定日期
// ========================================


async function loadSchedule(){


  schedule = [];




  // 沒選分店
  if(!selectedBranchId){


    return;


  }




  // 沒選日期
  if(!selectedDate){


    return;


  }




  const selectedBranch =
    branches.find(
      branch =>
        branch.id === selectedBranchId
    );


  const branchSlug =
    worldGymBranchSlug(
      selectedBranch?.official_url,
      selectedBranch?.name
    );




  // A branch with an official public schedule URL is read live from our
  // serverless parser. The parser returns World Gym's class_date directly.
  if(branchSlug){


    const response =
      await fetch(
        `/api/sync-worldgym?branch=${encodeURIComponent(branchSlug)}&date=${encodeURIComponent(selectedDate)}`
      );


    const payload =
      await response.json();


    if(!response.ok || !payload.success){


      throw new Error(
        payload.error || "World Gym 課表載入失敗"
      );


    }


    schedule =
      payload.classes.map(
        item => ({


          time: item.startTime || "",
          end: item.endTime || "",
          name: item.className || "未命名課程",
          room: item.classroom || "",
          instructor: item.instructor || "",
          type: item.category || ""


        })
      );


    return;


  }




  const params =
    new URLSearchParams({


      select:
        "date,start_time,end_time,room,instructor,classes(name,category)",


      branch_id:
        `eq.${selectedBranchId}`,


      date:
        `eq.${selectedDate}`,


      order:
        "start_time.asc"


    });




  const rows =
    await supabaseFetch(
      "class_schedules",
      params
    );




  schedule =
    rows.map(
      row => ({


        time:
          row.start_time
            ? row.start_time.slice(0,5)
            : "",


        end:
          row.end_time
            ? row.end_time.slice(0,5)
            : "",


        name:
          row.classes?.name ||
          "未命名課程",


        room:
          row.room || "",


        instructor:
          row.instructor || "",


        type:
          row.classes?.category || ""


      })
    );


}




// ========================================
// 選擇分店
// ========================================


async function changeBranch(
  branchId
){


  const branch =
    branches.find(
      item =>
        item.id === branchId
    );




  if(!branch){


    return;


  }




  selectedBranchId =
    branch.id;


  recordSearch("branch_search", branch.name);


  selectedBranchName =
    branch.name;


  selectedCity =
    branch.city || "";




  localStorage.setItem(
    "cq_branch_id",
    selectedBranchId
  );


  localStorage.setItem(
    "cq_branch_name",
    selectedBranchName
  );


  localStorage.setItem(
    "cq_city",
    selectedCity
  );




  // 選擇分店後
  // 如果還沒選日期，不抓課表


  if(selectedDate){


    await refreshSchedule();


  }else{


    render("classes");


  }


}




// ========================================
// 選擇縣市
// ========================================


function changeCity(city){


  selectedCity = city;


  if(city) recordSearch("city", city);


  localStorage.setItem(
    "cq_city",
    selectedCity
  );


  selectedBranchId = "";
  selectedBranchName = "";
  schedule = [];


  localStorage.removeItem(
    "cq_branch_id"
  );


  localStorage.removeItem(
    "cq_branch_name"
  );


  render("classes");


}




// ========================================
// 選擇日期
// ========================================


async function changeDate(
  date
){


  if(!date){


    selectedDate = "";


    localStorage.removeItem(
      "cq_date"
    );


    schedule = [];


    render("classes");


    return;


  }




  selectedDate =
    date;




  localStorage.setItem(
    "cq_date",
    selectedDate
  );




  // 沒選分店
  // 不查詢


  if(!selectedBranchId){


    render("classes");


    return;


  }




  await refreshSchedule();


}




// ========================================
// 重新抓課表
// ========================================


async function refreshSchedule(){


  const list =
    document.querySelector(
      "#classList"
    );




  if(list){


    list.innerHTML = `

      <div class="schedule-loading">

        正在載入
        ${formatDate(selectedDate)}
        的課表…

      </div>

    `;


  }




  try{


    await loadSchedule();


    render("classes");


  }catch(error){


    console.error(
      "Schedule error:",
      error
    );


    schedule = [];


    render("classes");


    toast(
      "⚠️ 課表載入失敗"
    );


  }


}




// ========================================
// 完成課程
// ========================================


async function completeWorkout(name){


  xp += 300;


  completed += 1;


  streak =
    Math.max(
      streak,
      1
    );




  localStorage.setItem(
    "cq_xp",
    xp
  );


  localStorage.setItem(
    "cq_completed",
    completed
  );


  localStorage.setItem(
    "cq_streak",
    streak
  );


  if(currentUser && authSession){
    try{
      await saveCloudProfile();
      await fetch(`${SUPABASE_URL}/rest/v1/workouts`, {
        method: "POST",
        headers: { ...authHeaders(), "Prefer": "return=minimal" },
        body: JSON.stringify({ user_id: currentUser.id, class_name: name, xp_awarded: 300 })
      });
    }catch(error){
      console.warn("Workout sync error:", error);
      toast("已完成課程，雲端同步稍後會再嘗試");
    }
  }




  toast(
    `🎉 ${name} 完成！ +300 XP`
  );




  render("home");


}




function saveTask(c){
  if(!selectedBranchId || !selectedDate) return toast("請先選好分店與日期");
  const task = { id:`${selectedBranchId}|${selectedDate}|${c.time}|${c.name}`, branchId:selectedBranchId, branchName:selectedBranchName, city:selectedCity, date:selectedDate, ...c };
  if(!savedTasks.some(item => item.id === task.id)) savedTasks.push(task);
  localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
  toast("已加入我的任務");
  nav("home");
}


function taskExpired(task){
  const end = new Date(`${task.date}T${task.end || task.time}:00`);
  return !Number.isNaN(end.getTime()) && new Date() > new Date(end.getTime() + 3600000);
}


function bindTaskSwipe(){
  document.querySelectorAll(".task-swipe[data-task-index]").forEach(wrapper => {
    let startX = 0;
    let offset = 0;
    const element = wrapper.querySelector(".saved-task");
    wrapper.addEventListener("touchstart", event => { startX = event.touches[0].clientX; offset = wrapper.classList.contains("swiped") ? -104 : 0; }, { passive:true });
    wrapper.addEventListener("touchmove", event => {
      const difference = Math.min(0, Math.max(-104, offset + event.touches[0].clientX - startX));
      element.style.transform = `translateX(${difference}px)`;
    }, { passive:true });
    element.addEventListener("touchend", event => {
      const difference = event.changedTouches[0].clientX - startX;
      element.style.transform = "";
      wrapper.classList.toggle("swiped", difference < -55 || (offset && difference < 35));
    }, { passive:true });
  });
}


function removeTask(index){
  savedTasks.splice(index, 1);
  localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
  toast("任務已移除");
  render("home");
}


function completeSavedTask(index){
  const task = savedTasks[index];
  if(!task) return;
  completeWorkout(task, task);
}


function bilingualCourseName(name){
  const pairs = [
    ["BODYCOMBAT", "有氧格鬥"], ["BODYPUMP", "槓鈴肌力"], ["BODYBALANCE", "身心靈平衡"],
    ["BODYATTACK", "有氧體能"], ["BODYJAM", "舞蹈有氧"], ["RPM", "飛輪"],
    ["SPRINT", "高強度飛輪"], ["瑜伽", "Yoga"], ["皮拉提斯", "Pilates"], ["飛輪", "Indoor Cycling"]
  ];
  const found = pairs.find(([first, second]) => String(name).toUpperCase().includes(first) || String(name).includes(second));
  return found ? `${name} · ${String(name).toUpperCase().includes(found[0]) ? found[1] : found[0]}` : name;
}


function distanceMeters(aLat, aLng, bLat, bLng){
  const rad = value => value * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}


function requestCurrentPosition(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation) return reject(new Error("此裝置不支援定位"));
    navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(error.code === 1 ? "請允許定位權限後再驗證" : "目前無法取得定位")), { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  });
}


async function completeWorkout(c, taskContext = null){
  if(!currentUser) return toast("請先使用 Google 登入");
  const context = taskContext || { branchId:selectedBranchId, branchName:selectedBranchName, city:selectedCity, date:selectedDate };
  if(!context.branchId || !context.date) return toast("請從課表選擇要完成的課程");
  const start = new Date(`${context.date}T${c.time}:00`);
  const now = new Date();
  if(Number.isNaN(start.getTime()) || now < start) return toast("不能完成任務的原因：尚未開課");
  if(now > new Date(start.getTime() + 3600000)) return toast("不能完成任務的原因：已超過開課後 1 小時");
  const branchLocation = worldGymBranchLocations.get(normalizedBranchName(context.branchName));
  if(!branchLocation?.latitude || !branchLocation?.longitude) return toast("此分店定位資料載入中，請稍後再試");
  try{
    toast("正在驗證你是否在分店 200 公尺內…");
    const position = await requestCurrentPosition();
    const meters = distanceMeters(position.coords.latitude, position.coords.longitude, branchLocation.latitude, branchLocation.longitude);
    if(meters > 200) return toast("不能完成任務的原因：未在任務區（需在分店 200 公尺內）");
    xp += 300; completed += 1; streak = Math.max(streak, 1);
    localStorage.setItem("cq_xp", xp); localStorage.setItem("cq_completed", completed); localStorage.setItem("cq_streak", streak);
    await saveCloudProfile();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/workouts`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ user_id:currentUser.id, class_name:c.name, xp_awarded:300, branch_name:context.branchName, city:context.city, class_start_at:start.toISOString(), verified:true, distance_meters:Math.round(meters) }) });
    if(!response.ok) throw new Error("完成紀錄同步失敗");
    savedTasks = savedTasks.filter(task => !(task.branchId === context.branchId && task.date === context.date && task.time === c.time && task.name === c.name));
    localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
    toast(`🎉 ${c.name} 已驗證完成！ +300 XP`); render("home");
  }catch(error){ toast(`⚠️ ${error.message}`); }
}


// ========================================
// 導覽
// ========================================


function nav(tab){


  localStorage.setItem(
    "cq_tab",
    tab
  );


  render(tab);


}




document
  .querySelectorAll("[data-tab]")
  .forEach(button => {


    button.addEventListener(
      "click",
      () => {


        nav(
          button.dataset.tab
        );


      }
    );


  });




// ========================================
// Render
// ========================================


function render(
  tab = "home"
){


  syncAvatar();


  document
    .querySelectorAll("[data-tab]")
    .forEach(button => {


      button.classList.toggle(
        "active",
        button.dataset.tab === tab
      );


    });




  const titles = {


    home:"首頁",


    classes:"課表",


    badges:"成就",


    social:"統計",


    profile:"我的"


  };




  title.textContent =
    titles[tab] || "首頁";




  if(tab === "home"){
    home();
  }


  if(tab === "classes"){
    classes();
  }


  if(tab === "badges"){
    badgePage();
  }


  if(tab === "social"){
    leaderboard();
  }


  if(tab === "profile"){
    profile();
  }


}




// ========================================
// 首頁
// ========================================


function home(){


  content.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        WELCOME BACK
      </div>

      <h2>
        ${(profileName || (currentUser ? currentUser.email.split("@")[0] : "運動夥伴"))} 👋
      </h2>

      <div class="muted">
        今天也把一點 XP 帶回家。
      </div>

      <div class="stats">

        <div class="stat">
          <b>
            ${xp.toLocaleString()}
          </b>
          <small>XP</small>
        </div>

        <div class="stat">
          <b>
            Lv.${Math.floor(xp / 1000) + 1}
          </b>
          <small>等級</small>
        </div>

        <div class="stat">
          <b>
            🔥 ${streak}
          </b>
          <small>Streak</small>
        </div>

      </div>

    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          🎯 今日任務
        </h3>

        <span>
          ${savedTasks.length} 項待解
        </span>

      </div>


      <div class="quest">

        <div class="row">

          <div>

            <span class="pill">
              DAILY QUEST
            </span>

            <h3 style="margin:8px 0 3px">
              完成一堂有氧課
            </h3>

            <div class="muted">
              完成任一課程即可獲得 XP
            </div>

          </div>

          <div class="xp">
            +300
          </div>

        </div>


        <div class="progress">

          <i
            style="
              width:${completed % 2 ? 100 : 35}%
            "
          ></i>

        </div>


        <button
          class="primary"
          onclick="nav('classes')"
        >
          找今天的課
        </button>

      </div>

    </section>


    <section class="section">
      <div class="section-title"><h3>🧩 待解任務</h3><span>左滑顯示刪除</span></div>
      ${savedTasks.length ? `<div class="saved-task-list">${savedTasks.map((task, index) => `<div class="task-swipe" data-task-index="${index}"><button class="task-delete" type="button" onclick="removeTask(${index})">刪除</button><div class="saved-task ${taskExpired(task) ? "expired" : ""}"><b>${escapeHtml(bilingualCourseName(task.name))}${taskExpired(task) ? " · 已逾期" : ""}</b><span>${escapeHtml(task.branchName)} · ${task.date} ${task.time}${task.end ? `–${task.end}` : ""}</span>${taskExpired(task) ? "" : `<button class="primary" type="button" onclick="completeSavedTask(${index})">完成任務</button>`}</div></div>`).join("")}</div>` : `<div class="quest muted">從課表按「加入任務」，就會出現在這裡。</div>`}
    </section>

  `;


  bindTaskSwipe();


}




// ========================================
// 課程卡片
// ========================================


function card(c){


  return `

    <article class="class-card">

      <div class="row">

        <div>

          <div class="class-time">
            ${c.time} - ${c.end}
          </div>

          <div class="class-name">
            ${bilingualCourseName(c.name)}
          </div>

          <div class="class-meta">

            ${c.room}
            · 教練
            ${c.instructor}

            <br>

            ${c.type}

          </div>

        </div>


        <div class="card-actions">
          <button class="ghost" onclick='saveTask(${JSON.stringify(c)})'>加入任務</button>
          <button class="primary" onclick='completeWorkout(${JSON.stringify(c)})'>驗證完成</button>
        </div>

      </div>

    </article>

  `;


}




// ========================================
// 課表
// ========================================


function classes(){


  injectScheduleStyles();




  // ======================================
  // 分店選單：依縣市分組
  // ======================================


  const cityOrder = [


    "基隆市",
    "臺北市",
    "新北市",
    "桃園市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    "臺中市",
    "彰化縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "臺南市",
    "高雄市",
    "屏東縣",
    "宜蘭縣",
    "花蓮縣",
    "臺東縣"


  ];




  const groupedBranches = {};




  branches.forEach(
    branch => {


      const city =
        branch.city || "其他地區";




      if(!groupedBranches[city]){


        groupedBranches[city] = [];


      }




      groupedBranches[city].push(
        branch
      );


    }
  );




  const sortedCities = [


    ...cityOrder.filter(
      city =>
        groupedBranches[city]
    ),


    ...Object.keys(groupedBranches)
      .filter(
        city =>
          !cityOrder.includes(city)
      )
      .sort(
        (a,b) =>
          a.localeCompare(
            b,
            "zh-Hant"
          )
      )


  ];




  const cityOptions =
    sortedCities
      .map(
        city => `
          <option
            value="${city}"
            ${city === selectedCity ? "selected" : ""}
          >
            ${city}
          </option>
        `
      )
      .join("");


  const branchOptions =
    (groupedBranches[selectedCity] || [])
      .sort(
        (a,b) =>
          a.name.localeCompare(
            b.name,
            "zh-Hant"
          )
      )
      .map(
        branch => `
          <option
            value="${branch.id}"
            ${branch.id === selectedBranchId ? "selected" : ""}
          >
            ${branch.name}
          </option>
        `
      )
      .join("");




  const selectedBranchDetails =
    branches.find(
      b =>
        b.id === selectedBranchId
    );


  const displayBranchSlug =
    worldGymBranchSlug(
      selectedBranchDetails?.official_url,
      selectedBranchDetails?.name
    );


  const officialUrl =
    selectedBranchDetails?.official_url ||
    (
      displayBranchSlug
        ? `https://www.worldgymtaiwan.com/en/find-a-club/${displayBranchSlug}/aerobics-class-schedule`
        : ""
    );


  const hasLiveWorldGymSchedule =
    Boolean(
      displayBranchSlug
    );




  content.innerHTML = `

    <section class="schedule-controls">


      <div class="schedule-control">

        <div class="schedule-control-label">
          🗺️ 縣市
        </div>

        <select
          id="citySelector"
          class="schedule-control-input"
        >

          <option
            value=""
            ${!selectedCity ? "selected" : ""}
          >
            請選擇縣市
          </option>

          ${cityOptions}

        </select>

      </div>


      <div class="schedule-control">

        <div class="schedule-control-label">
          📍 店名
        </div>


        <select
          id="branchSelector"
          class="schedule-control-input"
          ${!selectedCity ? "disabled" : ""}
        >

          <option
            value=""
            ${
              !selectedBranchId
                ? "selected"
                : ""
            }
          >
            請選擇店名
          </option>

          ${branchOptions}

        </select>

      </div>


      <div class="schedule-control">

        <div class="schedule-control-label">
          📅 日期
        </div>


        <input
          id="dateSelector"
          class="schedule-control-input schedule-date-input"
          type="date"
          value="${selectedDate}"
          ${
            !selectedBranchId
              ? "disabled"
              : ""
          }
        >

      </div>

    </section>


    ${
      !selectedBranchId

        ? `

          <div class="schedule-notice">

            📍 請先選擇分店

            <br><br>

            選擇分店後，
            就可以選擇日期查看課表。

          </div>

        `

        : !selectedDate

          ? `

            <div class="schedule-notice">

              📅 請選擇日期

            </div>

          `

          : `

            <input
              class="search"
              id="q"
              placeholder="搜尋課程，例如 BODYCOMBAT、瑜伽、飛輪"
            >


            <div class="filterbar">

              <button
                class="ghost"
                data-filter="all"
              >
                全部
              </button>

              <button
                class="ghost"
                data-filter="Les Mills"
              >
                Les Mills
              </button>

              <button
                class="ghost"
                data-filter="MOSSA"
              >
                MOSSA
              </button>

              <button
                class="ghost"
                data-filter="飛輪心率"
              >
                飛輪
              </button>

              <button
                class="ghost"
                data-filter="心肺肌力訓練"
              >
                有氧
              </button>

            </div>


            <section class="section">

              <div class="schedule-heading">

                <h3>
                  📍 ${selectedBranchName}
                </h3>

                <span class="schedule-heading-date">
                  ${formatDateSlash(selectedDate)}
                </span>

              </div>


              <div id="classList">

                ${
                  schedule.length

                    ? schedule
                        .map(card)
                        .join("")

                    : `

                      <div class="schedule-empty">

                        <div
                          style="
                            font-size:32px;
                            margin-bottom:8px
                          "
                        >
                          🗓️
                        </div>

                        <div
                          style="
                            font-weight:700;
                            margin-bottom:6px
                          "
                        >
                          本日沒有課程資料
                        </div>

                        <div
                          style="font-size:14px"
                        >
                          ${selectedBranchName}
                          ·
                          ${formatDate(selectedDate)}
                        </div>

                      </div>

                    `
                }

              </div>


              ${
                officialUrl

                  ? `

                    <div class="source">

                      資料來源：
                      World Gym Taiwan
                      公開有氧課表。

                      <br>

                      ${
                        hasLiveWorldGymSchedule
                          ? "本頁資料由 World Gym 公開課表即時解析。"
                          : "本頁資料由 CARDIO TAIWAN Supabase 資料庫提供。"
                      }

                      <br><br>

                      <a
                        href="${officialUrl}"
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看官方課表
                      </a>

                    </div>

                  `

                  : ""

              }

            </section>

          `

    }

  `;




  // ======================================
  // 縣市選擇
  // ======================================


  const citySelector =
    document.querySelector(
      "#citySelector"
    );


  if(citySelector){


    citySelector.addEventListener(
      "change",
      event => {
        changeCity(
          event.target.value
        );
      }
    );


  }




  // ======================================
  // 店名選擇
  // ======================================


  const branchSelector =
    document.querySelector(
      "#branchSelector"
    );




  if(branchSelector){


    branchSelector.addEventListener(
      "change",
      async event => {


        branchSelector.disabled =
          true;


        try{


          await changeBranch(
            event.target.value
          );


        }finally{


          branchSelector.disabled =
            false;


        }


      }
    );


  }




  // ======================================
  // 日期選擇
  // ======================================


  const dateSelector =
    document.querySelector(
      "#dateSelector"
    );




  if(dateSelector){


    dateSelector.addEventListener(
      "change",
      async event => {


        dateSelector.disabled =
          true;


        try{


          await changeDate(
            event.target.value
          );


        }finally{


          dateSelector.disabled =
            !selectedBranchId;


        }


      }
    );


  }




  // ======================================
  // 搜尋
  // ======================================


  const search =
    document.querySelector(
      "#q"
    );




  if(search){


    search.addEventListener(
      "input",
      event => {


        filterClasses(
          event.target.value
        );


      }
    );


  }




  // ======================================
  // 分類
  // ======================================


  document
    .querySelectorAll(
      "[data-filter]"
    )
    .forEach(
      button => {


        button.addEventListener(
          "click",
          () => {


            filterClasses(
              button.dataset.filter
            );


          }
        );


      }
    );


}




// ========================================
// 搜尋／篩選
// ========================================


function filterClasses(q){


  const list =
    document.querySelector(
      "#classList"
    );




  if(!list){
    return;
  }




  const term =
    (q || "all")
      .toLowerCase()
      .trim();




  const rows =
    schedule.filter(
      c => {


        if(term === "all"){
          return true;
        }




        return Object
          .values(c)
          .join(" ")
          .toLowerCase()
          .includes(term);


      }
    );




  list.innerHTML =


    rows.length


      ? rows
          .map(card)
          .join("")


      : `

        <div class="schedule-empty">

          <div
            style="
              font-size:30px;
              margin-bottom:8px
            "
          >
            🔎
          </div>

          找不到符合的課程。

        </div>

      `;


}




// ========================================
// 勳章
// ========================================


function badgePage(){


  const unlocked =
    badges.filter(
      b => b[3]
    ).length;




  content.innerHTML = `

    <div class="section-title">

      <h3>
        🏅 Badge Collection
      </h3>

      <span>
        ${Math.min(unlocked, completed)}
        / ${badges.length}
      </span>

    </div>


    <div class="badge-grid">

      ${badges.map(
        b => `

          <article
            class="
              badge
              ${b[3] ? "" : "locked"}
            "
          >

            <div class="badge-icon">
              ${b[0]}
            </div>

            <h4>
              ${b[1]}
            </h4>

            <p>
              ${b[2]}
            </p>

            ${
              b[3]

                ? `

                  <div
                    class="pill"
                    style="margin-top:12px"
                  >
                    UNLOCKED
                  </div>

                `

                : `

                  <div
                    style="margin-top:12px"
                  >
                    🔒 LOCKED
                  </div>

                `
            }

          </article>

        `
      ).join("")}

    </div>

  `;


}




// ========================================
// 社群
// ========================================


async function social(){
  const cities = [...new Set(branches.map(branch => branch.city).filter(Boolean))];
  const filteredBranches = branches.filter(branch => !socialCity || branch.city === socialCity);
  const cityOptions = cities.map(city => `<option value="${escapeHtml(city)}" ${city === socialCity ? "selected" : ""}>${escapeHtml(city)}</option>`).join("");
  const branchOptions = filteredBranches.map(branch => `<option value="${branch.id}" ${branch.id === socialBranchId ? "selected" : ""}>${escapeHtml(branch.name)}</option>`).join("");
  content.innerHTML = `
    <section class="section">
      <div class="section-title"><h3>👥 社群留言板</h3><span>依地區找運動夥伴</span></div>
      <div class="quest community-filters">
        <label>縣市<select onchange="changeSocialCity(this.value)"><option value="">全部縣市</option>${cityOptions}</select></label>
        <label>分店<select onchange="changeSocialBranch(this.value)"><option value="">全部分店</option>${branchOptions}</select></label>
      </div>
      ${currentUser ? `
        <form class="quest community-form" onsubmit="submitCommunityPost(event)">
          <h3>留下你的留言</h3>
          <textarea name="message" maxlength="500" required placeholder="分享今天的課程、揪團或運動心得…"></textarea>
          <button class="primary" type="submit">發布留言</button>
        </form>` : `
        <div class="quest"><b>登入後即可留言</b><p class="muted">你可在「我的」頁設定暱稱與 IG，讓留言更容易被認識。</p><button class="ghost" onclick="nav('profile')">前往登入</button></div>`}
      <div id="communityPosts" class="section"><div class="muted">載入留言中…</div></div>
    </section>`;
  await loadCommunityPosts();
}


function changeSocialCity(city){
  socialCity = city;
  socialBranchId = "";
  social();
}


function changeSocialBranch(branchId){
  socialBranchId = branchId;
  social();
}


async function loadCommunityPosts(){
  const target = document.querySelector("#communityPosts");
  if(!target) return;
  try{
    const params = new URLSearchParams({ select:"id,author_name,author_instagram,city,branch_name,message,created_at", order:"created_at.desc", limit:"100" });
    if(socialCity) params.set("city", `eq.${socialCity}`);
    if(socialBranchId){
      const branch = branches.find(item => item.id === socialBranchId);
      if(branch) params.set("branch_name", `eq.${branch.name}`);
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/community_posts?${params}`, { headers: authHeaders() });
    if(!response.ok) throw new Error("留言載入失敗");
    const posts = await response.json();
    target.innerHTML = posts.length ? posts.map(post => {
      const name = escapeHtml(post.author_name || "運動夥伴");
      const handle = String(post.author_instagram || "").replace(/^@/, "");
      const ig = handle ? `<a class="ig-link" href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener">@${escapeHtml(handle)}</a>` : "";
      const time = new Date(post.created_at).toLocaleString("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
      return `<article class="post"><div class="post-header"><div class="mini-avatar">${name.slice(0,1).toUpperCase()}</div><div><b>${name}</b>${ig}<div class="muted">${escapeHtml(post.city || "其他地區")} · ${escapeHtml(post.branch_name || "未指定分店")} · ${time}</div></div></div><p>${escapeHtml(post.message).replace(/\n/g,"<br>")}</p></article>`;
    }).join("") : `<div class="quest muted">這個地區目前還沒有留言，來當第一位吧！</div>`;
  }catch(error){ target.innerHTML = `<div class="quest muted">${escapeHtml(error.message)}</div>`; }
}


async function submitCommunityPost(event){
  event.preventDefault();
  const message = event.currentTarget.message.value.trim();
  const branch = branches.find(item => item.id === socialBranchId);
  if(!socialCity || !branch) return toast("請先選擇縣市與分店再留言");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/community_posts`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ user_id:currentUser.id, author_name:profileName || currentUser.email.split("@")[0], author_instagram:null, city:socialCity, branch_name:branch.name, message }) });
    if(!response.ok) throw new Error("留言發布失敗");
    toast("留言已發布");
    social();
  }catch(error){ toast(`⚠️ ${error.message}`); }
  finally{ button.disabled = false; }
}




async function leaderboard(){
  content.innerHTML = `<section class="section"><div class="section-title"><h3>🏆 排行榜</h3><span>已驗證完成與查詢熱度</span></div><div id="leaderboards" class="muted">載入排行榜中…</div></section>`;
  const target = document.querySelector("#leaderboards");
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/leaderboard_stats`, { method:"POST", headers:authHeaders(), body:"{}" });
    if(!response.ok) throw new Error("排行榜載入失敗");
    const rows = await response.json();
    const titles = { popular_class:"🔥 熱門有氧課", member:"👤 人員完成度", city:"🗺️ 地區查詢", branch_search:"📍 分店查詢", branch_complete:"🏢 分店課程完成", activity:"💪 運動項目完成" };
    target.innerHTML = Object.entries(titles).map(([kind, title]) => {
      const items = rows.filter(row => row.kind === kind).slice(0,5);
      return `<section class="quest leaderboard"><h3>${title}</h3>${items.length ? items.map((item,index) => `<div class="rank-row"><b>${index+1}. ${escapeHtml(item.label)}</b><span>${item.value}</span></div>`).join("") : `<div class="muted">尚無已驗證資料</div>`}</section>`;
    }).join("");
  }catch(error){ target.innerHTML = `<div class="quest muted">${escapeHtml(error.message)}</div>`; }
}


// ========================================
// 個人
// ========================================


async function adminRequest(action, payload = {}){
  if(!authSession?.access_token) throw new Error("請先登入管理員帳號");
  const response = await fetch("/api/admin", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${authSession.access_token}` },
    body:JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(result.error || "後台服務暫時無法使用");
  return result;
}


function renderAdminMembers(members = []){
  const target = document.querySelector("#admin-members");
  if(!target) return;
  target.innerHTML = members.length ? members.map(member => `<div class="rank-row"><div><b>${escapeHtml(member.display_name || "未設定暱稱")}</b><div class="muted">XP ${Number(member.xp || 0)} · 已登入會員</div></div><button class="ghost danger" type="button" onclick="deleteMember('${member.id}')">移除</button></div>`).join("") : `<div class="muted">找不到符合的會員</div>`;
}


async function findMembers(event){
  event?.preventDefault();
  const input = document.querySelector("#admin-member-query");
  try{
    const result = await adminRequest("members", { query:input?.value || "" });
    const count = document.querySelector("#member-count");
    if(count) count.textContent = `${result.total || 0} 位會員`;
    renderAdminMembers(result.members || []);
  }catch(error){ toast(`⚠️ ${error.message}`); }
}


async function deleteMember(id){
  if(!confirm("確定要移除此會員及其完成紀錄嗎？這個動作無法復原。")) return;
  try{
    await adminRequest("delete_member", { id });
    toast("會員已移除");
    findMembers();
  }catch(error){ toast(`⚠️ ${error.message}`); }
}


async function clearStatistics(){
  if(!confirm("確定要清空所有排行榜統計、完成紀錄與 XP 嗎？會員帳號不會被刪除，這個動作無法復原。")) return;
  try{
    await adminRequest("clear_statistics");
    toast("統計資料已清空");
    findMembers();
  }catch(error){ toast(`⚠️ ${error.message}`); }
}


function openAdmin(){
  if(!isAdmin) return toast("你沒有後台管理權限");
  content.innerHTML = `
    <section class="hero profile-card"><div class="big-avatar">管</div><h2>後台管理</h2><div class="muted">僅限管理員使用；清除與移除操作皆無法復原。</div></section>
    <section class="section"><div class="quest"><div class="section-title"><h3>會員管理</h3><span id="member-count">載入中…</span></div><form class="admin-search" onsubmit="findMembers(event)"><input id="admin-member-query" maxlength="40" placeholder="用暱稱搜尋會員"><button class="primary" type="submit">查詢</button></form><div id="admin-members" class="admin-members"><div class="muted">正在載入會員資料…</div></div></div></section>
    <section class="section"><div class="quest"><h3>統計資料</h3><p class="muted">清空排行榜、完成紀錄、XP 與連續天數；不會刪除會員帳號。</p><button class="ghost danger" type="button" onclick="clearStatistics()">清空統計數據</button></div></section>
    <section class="section"><button class="ghost" type="button" onclick="nav('profile')">返回我的</button></section>`;
  findMembers();
}


function profile(){


  if(!currentUser){
    content.innerHTML = `
      <section class="hero profile-card">
        <div class="big-avatar">G</div>
        <h2>建立你的運動帳號</h2>
        <div class="muted">使用 Google 登入後，XP、完成紀錄與勳章會安全同步到自己的帳號。</div>
      </section>
      <section class="section">
        <div class="quest google-login-card">
          <h3>使用 Google 繼續</h3>
          <p class="muted">不需要收取或點選驗證信。</p>
          <button class="google-login" type="button" onclick="signInWithGoogle()"><span aria-hidden="true">G</span> 使用 Google 繼續</button>
        </div>
      </section>`;
    return;
  }


  content.innerHTML = `

    <section class="hero profile-card">

      <div class="big-avatar">
        ${(profileName || currentUser.email).slice(0,1).toUpperCase()}
      </div>

      <h2>
        ${profileName || currentUser.email.split("@")[0]}
      </h2>

      <div class="muted">
        Level
        ${Math.floor(xp / 1000) + 1}
      </div>


      <div class="stats">

        <div class="stat">

          <b>
            ${completed}
          </b>

          <small>
            完成課程
          </small>

        </div>


        <div class="stat">

          <b>
            ${xp}
          </b>

          <small>
            XP
          </small>

        </div>


        <div class="stat">

          <b>
            ${streak}
          </b>

          <small>
            Streak
          </small>

        </div>

      </div>

    </section>

    <section class="section">
      <form class="quest profile-settings" onsubmit="updateProfile(event)">
        <div class="section-title"><h3>⚙️ 個人設定</h3><span>同步你的帳號資料</span></div>
        <label>暱稱<input name="display_name" maxlength="40" required value="${escapeHtml(profileName || currentUser.email.split("@")[0])}"></label>
        <label>背景主題<select name="theme_color">
          <option value="white" ${themeColor === "white" ? "selected" : ""}>白色</option>
          <option value="black" ${themeColor === "black" ? "selected" : ""}>黑色</option>
          <option value="navy" ${themeColor === "navy" ? "selected" : ""}>深藍色</option>
          <option value="gray" ${themeColor === "gray" ? "selected" : ""}>灰色</option>
        </select></label>
        <button class="primary" type="submit">儲存個人設定</button>
      </form>
    </section>

    <section class="section">
      <div class="account-actions"><button class="ghost" onclick="signOut()">登出帳號</button>${isAdmin ? `<button class="ghost" type="button" onclick="openAdmin()">後台管理</button>` : ""}</div>
    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          📊 我的紀錄
        </h3>

      </div>


      <div class="quest">

        <div class="row">

          <b>
            有氧完成率
          </b>

          <span class="xp">
            ${Math.min(
              100,
              completed * 8
            )}%
          </span>

        </div>


        <div class="progress">

          <i
            style="
              width:${Math.min(
                100,
                completed * 8
              )}%
            "
          ></i>

        </div>

      </div>

    </section>

  `;


}




// ========================================
// INIT
// ========================================


async function init(){


  try{


    injectScheduleStyles();
    applyTheme(themeColor, false);


    // Google OAuth 完成後會把工作階段放在網址雜湊中；取用後立刻清除網址。
    consumeAuthCallback();


    // 還原既有登入狀態；失效的工作階段會安全地回到訪客模式。
    await restoreSession();




    // ① 載入分店
    await loadBranches();


    // ② 載入 World Gym 公開分店對應，不影響既有 Supabase 資料。
    await loadWorldGymBranchSlugs();




    // ③ 只有「已經有分店＋日期」
    // 才載入課表


    if(
      selectedBranchId &&
      selectedDate
    ){


      await loadSchedule();


    }else{


      schedule = [];


    }




    // ④ 顯示目前頁面


    render(
      localStorage.getItem(
        "cq_tab"
      ) || "home"
    );




  }catch(error){


    console.error(
      "Supabase error:",
      error
    );




    schedule = [];




    render(
      localStorage.getItem(
        "cq_tab"
      ) || "home"
    );




    toast(
      "⚠️ 資料載入失敗"
    );


  }


}




// ========================================
// START
// ========================================


init();




















































