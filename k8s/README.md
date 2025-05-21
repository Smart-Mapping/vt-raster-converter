### Deployment der Komponenten

PVC für Eingangsdaten und MapProxy-Cache anlegen:
```
kubectl apply -n pxx -f k8s/storage/storage-class.yaml
kubectl apply -n pxx -f k8s/storage/data-pvc.yaml
```

MapProxy (Seeding) anlegen:
```
helm upgrade --install -n pxx mapproxy k8s/mapproxy-chart/
```

VT Raster Converter anlegen:
```
helm upgrade --install -n pxx vt-raster-converter k8s/vt-raster-converter-chart/
```